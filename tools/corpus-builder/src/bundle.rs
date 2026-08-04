use std::{collections::HashMap, fs, path::Path};

use anyhow::{Context, Result, bail};
use chrono::DateTime;
use rusqlite::{Connection, Transaction, params};
use serde_json::{Map, Value, json};

use crate::{
    config,
    contract::{self, Analysis, EvaluationRun, InventoryRun, Manifest, MetricSummary},
    identity::hash_json,
    loader::{
        BenchmarkBinding, CorpusBindings, benchmark_target_binding, ensure_route, execute_cached,
        stable_id,
    },
    stream::{
        EvaluationSink, parse_hashed_json_gz, resolve_confined_regular, stream_candidate_digests,
        stream_evaluation,
    },
    wire::{
        EvaluationHeader, ScoredCandidate, TargetResult, database_status, effective_constraints,
        route_content_hash, route_depth, route_signature_at_depth,
        validate_stock_termination_constraint,
    },
};

#[derive(Default)]
pub struct ImportTotals {
    pub runs: usize,
    pub targets: usize,
    pub candidates: usize,
    pub routes: usize,
    pub failures: usize,
}

pub fn import_run(
    connection: &mut Connection,
    corpus_root: &Path,
    entry: &InventoryRun,
    bindings: &CorpusBindings,
) -> Result<ImportTotals> {
    let configured_benchmark =
        config::benchmark(&entry.benchmark).context("unknown inventory benchmark")?;
    if configured_benchmark.stock != entry.stock || config::model(&entry.model).is_none() {
        bail!(
            "inventory run {} has an unknown model or benchmark stock",
            entry.run_id
        );
    }
    let expected_bundle_suffix = Path::new("bundles")
        .join(&entry.benchmark)
        .join(&entry.model);
    if !Path::new(&entry.bundle_path).ends_with(&expected_bundle_suffix)
        || entry.adapter.trim().is_empty()
    {
        bail!(
            "inventory bundle path or adapter binding is invalid for {}",
            entry.run_id
        );
    }
    let bundle_relative = Path::new("bundles")
        .join(&entry.benchmark)
        .join(&entry.model);
    let manifest_relative = bundle_relative.join("manifest.json");
    let manifest_path = resolve_confined_regular(
        corpus_root,
        manifest_relative
            .to_str()
            .context("bundle manifest path is not UTF-8")?,
    )?;
    let bundle_root = manifest_path
        .parent()
        .context("bundle manifest has no parent")?
        .to_owned();
    let (manifest, manifest_json) =
        contract::load_manifest(&manifest_path, &entry.manifest_sha256)?;
    if manifest.parameters.get("adapter").and_then(Value::as_str) != Some(entry.adapter.as_str()) {
        bail!(
            "manifest adapter disagrees with inventory for {}",
            entry.run_id
        );
    }
    validate_manifest_sources(connection, &manifest, entry, bindings)?;

    let candidates_info = contract::tracked_output(&manifest, "candidates.json.gz")?;
    let evaluation_info = contract::tracked_output(&manifest, "evaluation.json.gz")?;
    let analysis_info = contract::tracked_output(&manifest, "analysis.json.gz")?;
    let evaluation_run_info = contract::tracked_output(&manifest, "evaluation-run.json")?;
    let candidates_path = resolve_confined_regular(&bundle_root, &candidates_info.path)?;
    let evaluation_path = resolve_confined_regular(&bundle_root, &evaluation_info.path)?;
    let analysis_path = resolve_confined_regular(&bundle_root, &analysis_info.path)?;
    let evaluation_run_path = resolve_confined_regular(&bundle_root, &evaluation_run_info.path)?;
    contract::verify_unparsed_outputs(
        &bundle_root,
        &manifest,
        &[
            "candidates.json.gz",
            "evaluation.json.gz",
            "analysis.json.gz",
            "evaluation-run.json",
        ],
    )?;

    let (candidate_digests, candidate_count) =
        stream_candidate_digests(&candidates_path, &candidates_info.sha256)?;
    let analysis: Analysis = parse_hashed_json_gz(&analysis_path, &analysis_info.sha256)?;
    validate_analysis_shape(&analysis)?;
    let evaluation_run =
        read_hashed_json::<EvaluationRun>(&evaluation_run_path, &evaluation_run_info.sha256)?;
    validate_run_metadata(
        entry,
        &manifest,
        &analysis,
        &evaluation_run,
        candidate_digests.len(),
        candidate_count,
    )?;

    let benchmark = bindings
        .benchmarks
        .get(&entry.benchmark)
        .context("benchmark binding missing")?;
    let benchmark_id = &benchmark.id;
    let model_id = bindings
        .models
        .get(&entry.model)
        .context("model binding missing")?;
    let prediction_run_id = stable_id("prediction-run", &entry.run_id);
    let transaction = connection.transaction()?;
    execute_cached(
        &transaction,
        "INSERT INTO PredictionRun (id, modelInstanceId, benchmarkSetId, retrocastVersion, commandParams, executedAt, submissionType, totalCandidates, totalFailures, totalRoutes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'COMMUNITY_SUBMITTED', 0, 0, 0)",
        params![
            prediction_run_id,
            model_id,
            benchmark_id,
            manifest.retrocast_version,
            serde_json::to_string(&manifest.parameters)?,
            DateTime::parse_from_rfc3339(&manifest.created_at)?.to_rfc3339(),
        ],
    )?;
    let mut sink = BundleSink {
        transaction: &transaction,
        entry,
        manifest: &manifest,
        manifest_json: &manifest_json,
        analysis: &analysis,
        prediction_run_id: &prediction_run_id,
        benchmark_id,
        benchmark,
        stock_id: bindings
            .stocks
            .get(&entry.stock)
            .context("stock binding missing")?,
        candidate_digests,
        evaluation_id: None,
        header: None,
        totals: ImportTotals::default(),
        stats: HashMap::new(),
    };
    stream_evaluation(&evaluation_path, &evaluation_info.sha256, &mut sink)?;
    let totals = sink.complete()?;
    transaction.commit()?;
    Ok(totals)
}

fn validate_manifest_sources(
    connection: &Connection,
    manifest: &Manifest,
    entry: &InventoryRun,
    bindings: &CorpusBindings,
) -> Result<()> {
    let benchmark_hash: String = connection.query_row(
        "SELECT sourceSha256 FROM BenchmarkSet WHERE id = ?1",
        [&bindings
            .benchmarks
            .get(&entry.benchmark)
            .context("benchmark binding missing")?
            .id],
        |row| row.get(0),
    )?;
    let stock_hash: String = connection.query_row(
        "SELECT sourceSha256 FROM Stock WHERE id = ?1",
        [bindings
            .stocks
            .get(&entry.stock)
            .context("stock binding missing")?],
        |row| row.get(0),
    )?;
    for (name, expected) in [
        (format!("{}.json.gz", entry.benchmark), benchmark_hash),
        (format!("{}.csv.gz", entry.stock), stock_hash),
    ] {
        let matches: Vec<_> = manifest
            .source_files
            .iter()
            .filter(|file| {
                Path::new(&file.path)
                    .file_name()
                    .is_some_and(|value| value == name.as_str())
            })
            .collect();
        if matches.len() != 1 || matches[0].sha256.to_ascii_lowercase() != expected {
            bail!("manifest source binding mismatch for {name}");
        }
    }
    for (label, expected_path, expected_hash) in [
        ("planner result", &entry.raw_path, &entry.raw_sha256),
        (
            "execution stats",
            &entry.execution_stats_path,
            &entry.execution_stats_sha256,
        ),
    ] {
        let matches: Vec<_> = manifest
            .source_files
            .iter()
            .filter(|file| {
                file.path == *expected_path && file.sha256.eq_ignore_ascii_case(expected_hash)
            })
            .collect();
        if matches.len() != 1 {
            bail!("manifest does not bind the exact inventory {label} path/hash tuple");
        }
    }
    Ok(())
}

fn validate_analysis_shape(analysis: &Analysis) -> Result<()> {
    if analysis.schema_version != "2" {
        bail!("analysis schema must be exactly 2");
    }
    for (scope, metrics) in std::iter::once(("overall", &analysis.metrics)).chain(
        analysis
            .by_stratum
            .iter()
            .map(|(name, metrics)| (name.as_str(), metrics)),
    ) {
        if metrics.is_empty() {
            bail!("analysis metric scope {scope} is empty");
        }
        for (key, metric) in metrics {
            let bounded_metric = key.starts_with("tier_0_validity_")
                || key.starts_with("solv_0[")
                || key.starts_with("acceptable_");
            if key.is_empty()
                || !metric.value.is_finite()
                || (bounded_metric && !(0.0..=1.0).contains(&metric.value))
                || (metric.count == 0
                    && (metric.value != 0.0
                        || metric.ci_low.is_some()
                        || metric.ci_high.is_some()
                        || metric.reliability.as_ref().map(|value| value.code.as_str())
                            != Some("LOW_N")))
            {
                bail!("analysis metric {scope}.{key} is invalid");
            }
            if let Some(reliability) = &metric.reliability {
                if !matches!(reliability.code.as_str(), "OK" | "LOW_N" | "EXTREME_P")
                    || reliability.message.trim().is_empty()
                {
                    bail!("analysis metric {scope}.{key} has an unknown reliability code");
                }
            }
            if bounded_metric && metric.count > 0 {
                let (Some(low), Some(high), Some(_)) =
                    (metric.ci_low, metric.ci_high, metric.reliability.as_ref())
                else {
                    bail!("analysis metric {scope}.{key} lacks CI or reliability evidence");
                };
                if !low.is_finite()
                    || !high.is_finite()
                    || !(0.0..=metric.value).contains(&low)
                    || !(metric.value..=1.0).contains(&high)
                {
                    bail!("analysis metric {scope}.{key} has an incoherent confidence interval");
                }
            }
        }
    }
    Ok(())
}

fn validate_run_metadata(
    entry: &InventoryRun,
    manifest: &Manifest,
    analysis: &Analysis,
    run: &EvaluationRun,
    candidate_targets: usize,
    candidate_count: usize,
) -> Result<()> {
    let manifest_targets = manifest.statistics.get("targets").and_then(Value::as_u64);
    let manifest_candidates = manifest
        .statistics
        .get("candidates")
        .and_then(Value::as_u64);
    let manifest_workers = manifest.parameters.get("workers").and_then(Value::as_u64);
    let manifest_bootstrap = manifest.parameters.get("n_boot").and_then(Value::as_u64);
    for (label, value) in [
        ("ingest_seconds", run.ingest_seconds),
        ("score_seconds", run.score_seconds),
        ("analyze_seconds", run.analyze_seconds),
        ("total_seconds", run.total_seconds),
        ("targets_per_second", run.targets_per_second),
        ("candidates_per_second", run.candidates_per_second),
    ] {
        if !value.is_finite() || value < 0.0 {
            bail!("evaluation-run {label} must be finite and non-negative");
        }
    }
    if run.engine != "rust"
        || run.workers == 0
        || run.targets != entry.targets
        || run.candidates != entry.candidates
        || candidate_targets != entry.targets
        || candidate_count != entry.candidates
        || manifest_targets != Some(entry.targets as u64)
        || manifest_candidates != Some(entry.candidates as u64)
        || manifest.parameters.get("mode").and_then(Value::as_str) != Some("strict")
        || manifest_workers != Some(run.workers as u64)
        || manifest_bootstrap != Some(analysis.bootstrap_resamples as u64)
        || manifest.parameters.get("seed").and_then(Value::as_u64) != Some(42)
        || run.workers != entry.runtime.workers
        || !float_eq(run.ingest_seconds, entry.runtime.ingest_seconds)
        || !float_eq(run.score_seconds, entry.runtime.score_seconds)
        || !float_eq(run.analyze_seconds, entry.runtime.analyze_seconds)
        || !float_eq(run.total_seconds, entry.runtime.total_seconds)
        || !float_eq(run.targets_per_second, entry.runtime.targets_per_second)
        || !float_eq(
            run.candidates_per_second,
            entry.runtime.candidates_per_second,
        )
    {
        bail!(
            "evaluation-run, manifest, candidate, or inventory counts disagree for {}",
            entry.run_id
        );
    }
    Ok(())
}

fn read_hashed_json<T: serde::de::DeserializeOwned>(path: &Path, expected: &str) -> Result<T> {
    let bytes = fs::read(path)?;
    if crate::sha256_bytes(&bytes) != expected.to_ascii_lowercase() {
        bail!("SHA-256 mismatch for {}", path.display());
    }
    Ok(serde_json::from_slice(&bytes)?)
}

#[derive(Clone, Default)]
struct MetricAccumulator {
    count: usize,
    tier_rate: f64,
    solv_rate: f64,
    tier_mrr: f64,
    solv_mrr: f64,
    acceptable_top_k: [f64; 7],
}

struct BundleSink<'a> {
    transaction: &'a Transaction<'a>,
    entry: &'a InventoryRun,
    manifest: &'a Manifest,
    manifest_json: &'a str,
    analysis: &'a Analysis,
    prediction_run_id: &'a str,
    benchmark_id: &'a str,
    benchmark: &'a BenchmarkBinding,
    stock_id: &'a str,
    candidate_digests: HashMap<String, (usize, String)>,
    evaluation_id: Option<String>,
    header: Option<EvaluationHeader>,
    totals: ImportTotals,
    stats: HashMap<String, MetricAccumulator>,
}

impl EvaluationSink for BundleSink<'_> {
    fn begin(&mut self, header: &EvaluationHeader) -> Result<()> {
        if self.header.is_some()
            || header.task_name != self.entry.benchmark
            || header.tiers != [0]
            || header.metric_label != self.entry.stock
            || header.task_metric_label.is_some()
            || self.entry.solv_0_rate_key != format!("solv_0[{}]_rate", header.metric_label)
            || header.acceptable_match_level != "full"
            || header.acceptable_route_match != "prefix"
            || self
                .manifest
                .parameters
                .get("match_level")
                .and_then(Value::as_str)
                != Some(header.acceptable_match_level.as_str())
            || self
                .manifest
                .parameters
                .get("acceptable_route_match")
                .and_then(Value::as_str)
                != Some(header.acceptable_route_match.as_str())
        {
            bail!(
                "evaluation header disagrees with inventory for {}",
                self.entry.run_id
            );
        }
        if header.task_default_constraints != self.benchmark.default_constraints
            || header.task_constraints != self.benchmark.target_constraints
        {
            bail!("evaluation task constraints differ from the canonical benchmark definition");
        }
        let evaluation_id = stable_id(
            "run-evaluation",
            &format!("{}/{}", self.prediction_run_id, header.metric_label),
        );
        execute_cached(
            self.transaction,
            "INSERT INTO RunEvaluation (id, predictionRunId, benchmarkSetId, stockId, metricLabel, evaluatedTiers, taskJson, parametersJson, analysisJson, manifestJson, manifestSha256, artifactSchema, retrocastVersion, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                evaluation_id,
                self.prediction_run_id,
                self.benchmark_id,
                self.stock_id,
                header.metric_label,
                serde_json::to_string(&header.tiers)?,
                header.task_json,
                serde_json::to_string(&self.manifest.parameters)?,
                serde_json::to_string(self.analysis)?,
                self.manifest_json,
                self.entry.manifest_sha256,
                self.manifest.schema_version,
                self.manifest.retrocast_version,
                DateTime::parse_from_rfc3339(&self.manifest.created_at)?.to_rfc3339(),
            ],
        )?;
        self.evaluation_id = Some(evaluation_id);
        self.header = Some(header.clone());
        Ok(())
    }

    fn target(&mut self, external_id: &str, target: TargetResult) -> Result<()> {
        let evaluation_id = self
            .evaluation_id
            .as_ref()
            .context("evaluation target arrived before header")?;
        if target.target.id != external_id {
            bail!("evaluation target key/id mismatch for {external_id}");
        }
        let (target_id, db_smiles, db_inchikey) =
            benchmark_target_binding(self.transaction, self.benchmark_id, external_id)?
                .with_context(|| {
                    format!("evaluation target {external_id} is absent from benchmark")
                })?;
        if db_smiles != target.target.smiles || db_inchikey != target.target.inchikey {
            bail!("evaluation target {external_id} differs from its benchmark binding");
        }
        for route in &target.target.acceptable_routes {
            validate_route_root(
                route,
                external_id,
                &target.target.smiles,
                &target.target.inchikey,
                "acceptable route",
            )?;
        }
        let db_route_hashes: Vec<String> = {
            let mut statement = self.transaction.prepare(
                "SELECT r.contentHash FROM AcceptableRoute ar JOIN Route r ON r.id = ar.routeId WHERE ar.benchmarkTargetId = ?1 ORDER BY ar.routeIndex",
            )?;
            statement
                .query_map([&target_id], |row| row.get(0))?
                .collect::<std::result::Result<_, _>>()?
        };
        let evaluation_route_hashes: Vec<_> = target
            .target
            .acceptable_routes
            .iter()
            .map(route_content_hash)
            .collect();
        if db_route_hashes != evaluation_route_hashes {
            bail!("evaluation target {external_id} acceptable routes differ from benchmark");
        }
        let expected_constraints = effective_constraints(
            &self.benchmark.default_constraints,
            &self.benchmark.target_constraints,
            external_id,
        )?;
        if target.effective_constraints != expected_constraints {
            bail!("evaluation target {external_id} effective constraints differ from benchmark");
        }
        validate_stock_termination_constraint(&target.effective_constraints, &self.entry.stock)?;
        let projection: Vec<_> = target
            .candidates
            .iter()
            .map(ScoredCandidate::candidate_projection)
            .collect();
        let digest = hash_json(&serde_json::to_value(&projection)?);
        let expected = self
            .candidate_digests
            .remove(external_id)
            .with_context(|| format!("candidate artifact is missing target {external_id}"))?;
        if expected != (projection.len(), digest) {
            bail!("candidate and evaluation payloads differ for target {external_id}");
        }
        validate_candidate_ranks(&target.candidates)?;

        let target_evaluation_id = stable_id(
            "target-evaluation",
            &format!("{evaluation_id}/{external_id}"),
        );
        execute_cached(
            self.transaction,
            "INSERT INTO TargetEvaluation (id, runEvaluationId, predictionRunId, targetId, benchmarkSetId, effectiveConstraintsJson, wallTime, cpuTime) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                target_evaluation_id,
                evaluation_id,
                self.prediction_run_id,
                target_id,
                self.benchmark_id,
                serde_json::to_string(&target.effective_constraints)?,
                target.wall_time,
                target.cpu_time,
            ],
        )?;

        for candidate in &target.candidates {
            candidate.validate()?;
            validate_candidate_profile(candidate, &target.target.acceptable_routes)?;
            if let Some(route) = &candidate.route {
                validate_route_root(
                    route,
                    external_id,
                    &target.target.smiles,
                    &target.target.inchikey,
                    "candidate route",
                )?;
            }
            if let Some(failure) = &candidate.failure {
                if failure
                    .target_id
                    .as_deref()
                    .is_some_and(|value| value != external_id)
                    || failure
                        .target_smiles
                        .as_deref()
                        .is_some_and(|value| value != target.target.smiles)
                    || failure
                        .target_inchikey
                        .as_deref()
                        .is_some_and(|value| value != target.target.inchikey)
                {
                    bail!("candidate failure target binding disagrees for {external_id}");
                }
            }
            let candidate_id = stable_id(
                "prediction-candidate",
                &format!(
                    "{}/{external_id}/{}",
                    self.prediction_run_id, candidate.rank
                ),
            );
            let (route_id, failure_code, failure_message, failure_details, metadata) =
                if let Some(route) = &candidate.route {
                    (
                        Some(ensure_route(self.transaction, route)?),
                        None,
                        None,
                        None,
                        Some(serde_json::to_string(&route.annotations)?),
                    )
                } else {
                    let failure = candidate
                        .failure
                        .as_ref()
                        .context("failure candidate missing failure")?;
                    (
                        None,
                        Some(failure.code.clone()),
                        failure.message.clone(),
                        Some(serde_json::to_string(failure)?),
                        None,
                    )
                };
            execute_cached(
                self.transaction,
                "INSERT INTO PredictionCandidate (id, routeId, predictionRunId, targetId, benchmarkSetId, rank, metadata, failureCode, failureMessage, failureDetails) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(predictionRunId, targetId, rank) DO NOTHING",
                params![
                    candidate_id,
                    route_id,
                    self.prediction_run_id,
                    target_id,
                    self.benchmark_id,
                    candidate.rank as i64,
                    metadata,
                    failure_code,
                    failure_message,
                    failure_details
                ],
            )?;
            assert_candidate_reuse(
                self.transaction,
                CandidateReuse {
                    id: &candidate_id,
                    prediction_run_id: self.prediction_run_id,
                    target_id: &target_id,
                    benchmark_id: self.benchmark_id,
                    rank: candidate.rank,
                    route_id: route_id.as_deref(),
                    failure_code: failure_code.as_deref(),
                    failure_message: failure_message.as_deref(),
                    failure_details: failure_details.as_deref(),
                    metadata: metadata.as_deref(),
                },
            )?;
            let candidate_evaluation_id = stable_id(
                "candidate-evaluation",
                &format!("{evaluation_id}/{candidate_id}"),
            );
            execute_cached(
                self.transaction,
                "INSERT INTO CandidateEvaluation (id, runEvaluationId, targetEvaluationId, predictionRunId, targetId, benchmarkSetId, candidateId, constraintStatus, constraintChecksJson, validityEvidenceJson, matchesAcceptable, matchedAcceptableIndex) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    candidate_evaluation_id,
                    evaluation_id,
                    target_evaluation_id,
                    self.prediction_run_id,
                    target_id,
                    self.benchmark_id,
                    candidate_id,
                    database_status(&candidate.constraints.status)?,
                    serde_json::to_string(&candidate.constraints.checks)?,
                    validity_evidence(candidate)?,
                    candidate.matches_acceptable,
                    candidate.matched_acceptable_index.map(|value| value as i64),
                ],
            )?;
            for (tier, result) in &candidate.validity.tiers {
                execute_cached(
                    self.transaction,
                    "INSERT INTO CandidateTierResult (id, candidateEvaluationId, tier, status, checksJson) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        stable_id(
                            "candidate-tier",
                            &format!("{candidate_evaluation_id}/{tier}")
                        ),
                        candidate_evaluation_id,
                        *tier as i64,
                        database_status(&result.status)?,
                        serde_json::to_string(&result.checks)?,
                    ],
                )?;
            }
            if candidate.route.is_some() {
                self.totals.routes += 1;
            } else {
                self.totals.failures += 1;
            }
            self.totals.candidates += 1;
        }
        self.record_metrics(&target)?;
        self.totals.targets += 1;
        Ok(())
    }

    fn finish(&mut self, schema_version: &str) -> Result<()> {
        if schema_version != "2"
            || self.evaluation_id.is_none()
            || !self.candidate_digests.is_empty()
        {
            bail!("evaluation schema, header, or target set is incomplete");
        }
        self.validate_metrics()?;
        Ok(())
    }
}

impl BundleSink<'_> {
    fn record_metrics(&mut self, target: &TargetResult) -> Result<()> {
        let mut tier_rank = None;
        let mut solv_rank = None;
        for candidate in &target.candidates {
            let tier_pass = candidate
                .validity
                .tiers
                .get(&0)
                .is_some_and(|value| value.status == "pass");
            if candidate.route.is_some() && tier_pass {
                tier_rank =
                    Some(tier_rank.map_or(candidate.rank, |rank: usize| rank.min(candidate.rank)));
                if candidate.constraints.status == "pass" {
                    solv_rank = Some(
                        solv_rank.map_or(candidate.rank, |rank: usize| rank.min(candidate.rank)),
                    );
                }
            }
        }
        let task_satisfying: Vec<_> = target
            .candidates
            .iter()
            .filter(|candidate| satisfies_task(candidate))
            .collect();
        let stratum = target_stratum(target);
        for label in std::iter::once(String::new()).chain(stratum) {
            let stats = self.stats.entry(label).or_default();
            stats.count += 1;
            if let Some(rank) = tier_rank {
                stats.tier_rate += 1.0;
                stats.tier_mrr += 1.0 / rank as f64;
            }
            if let Some(rank) = solv_rank {
                stats.solv_rate += 1.0;
                stats.solv_mrr += 1.0 / rank as f64;
            }
            for (index, k) in [1, 3, 5, 10, 20, 50, 100].iter().enumerate() {
                if task_satisfying
                    .iter()
                    .take(*k)
                    .any(|candidate| candidate.matches_acceptable)
                {
                    stats.acceptable_top_k[index] += 1.0;
                }
            }
        }
        Ok(())
    }

    fn validate_metrics(&self) -> Result<()> {
        let label = &self
            .header
            .as_ref()
            .context("evaluation header missing")?
            .metric_label;
        for (stratum, stats) in &self.stats {
            let metrics = if stratum.is_empty() {
                &self.analysis.metrics
            } else {
                self.analysis
                    .by_stratum
                    .get(stratum)
                    .with_context(|| format!("analysis is missing derived stratum {stratum}"))?
            };
            for (key, sum) in [
                ("tier_0_validity_rate".to_owned(), stats.tier_rate),
                ("tier_0_validity_mrr".to_owned(), stats.tier_mrr),
                (format!("solv_0[{label}]_rate"), stats.solv_rate),
                (format!("solv_0[{label}]_mrr"), stats.solv_mrr),
            ] {
                let metric = metrics.get(&key).with_context(|| {
                    format!(
                        "analysis is missing {}{}",
                        if stratum.is_empty() { "" } else { stratum },
                        key
                    )
                })?;
                assert_metric(metric, sum / stats.count as f64, stats.count, &key)?;
            }
            for (index, k) in [1, 3, 5, 10, 20, 50, 100].iter().enumerate() {
                let key = format!("acceptable_reconstruction_top_{k}[{label}]");
                let metric = metrics.get(&key).with_context(|| {
                    format!("analysis is missing independently derived metric {key}")
                })?;
                assert_metric(
                    metric,
                    stats.acceptable_top_k[index] / stats.count as f64,
                    stats.count,
                    &key,
                )?;
            }
        }
        let overall = self
            .stats
            .get("")
            .context("overall metric accumulator missing")?;
        assert_metric(
            &self.entry.tier_0_validity_rate,
            overall.tier_rate / overall.count as f64,
            overall.count,
            "inventory tier_0_validity_rate",
        )?;
        assert_metric(
            &self.entry.solv_0_rate,
            overall.solv_rate / overall.count as f64,
            overall.count,
            "inventory solv_0_rate",
        )?;
        Ok(())
    }

    fn complete(mut self) -> Result<ImportTotals> {
        if self.totals.targets != self.entry.targets
            || self.totals.candidates != self.entry.candidates
            || self.totals.routes != self.entry.routes
            || self.totals.failures != self.entry.failures
        {
            bail!(
                "imported counts disagree with inventory for {}",
                self.entry.run_id
            );
        }
        let evaluation_id = self
            .evaluation_id
            .take()
            .context("evaluation was not initialized")?;
        for (stratum, metrics) in std::iter::once(("", &self.analysis.metrics)).chain(
            self.analysis
                .by_stratum
                .iter()
                .map(|(name, metrics)| (name.as_str(), metrics)),
        ) {
            for (key, metric) in metrics {
                execute_cached(
                    self.transaction,
                    "INSERT INTO MetricEstimate (id, runEvaluationId, metricKey, stratum, value, ciLower, ciUpper, nSamples, reliabilityCode, reliabilityMessage) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        stable_id("metric", &format!("{evaluation_id}/{stratum}/{key}")),
                        evaluation_id,
                        key,
                        stratum,
                        metric.value,
                        metric.ci_low,
                        metric.ci_high,
                        metric.count as i64,
                        metric.reliability.as_ref().map(|value| value.code.as_str()),
                        metric
                            .reliability
                            .as_ref()
                            .map(|value| value.message.as_str()),
                    ],
                )?;
            }
        }
        let execution_source = self
            .manifest
            .source_files
            .iter()
            .find(|file| file.path == self.entry.execution_stats_path)
            .context("execution stats source missing")?;
        let average_length: Option<f64> = self.transaction.query_row(
            "SELECT AVG(r.length) FROM PredictionCandidate pc JOIN Route r ON r.id = pc.routeId WHERE pc.predictionRunId = ?1",
            [self.prediction_run_id],
            |row| row.get(0),
        )?;
        execute_cached(
            self.transaction,
            "UPDATE PredictionRun SET executionStatsPath = ?2, executionStatsSha256 = ?3, timedTargets = ?4, totalWallTime = ?5, totalCpuTime = ?6, meanWallTime = ?7, meanCpuTime = ?8, totalCandidates = ?9, totalFailures = ?10, totalRoutes = ?11, avgRouteLength = ?12 WHERE id = ?1",
            params![
                self.prediction_run_id,
                execution_source.path,
                execution_source.sha256,
                self.analysis.runtime.timed_target_count as i64,
                self.analysis.runtime.total_wall_time,
                self.analysis.runtime.total_cpu_time,
                self.analysis.runtime.mean_wall_time,
                self.analysis.runtime.mean_cpu_time,
                self.totals.candidates as i64,
                self.totals.failures as i64,
                self.totals.routes as i64,
                average_length,
            ],
        )?;
        self.totals.runs = 1;
        Ok(self.totals)
    }
}

fn satisfies_task(candidate: &ScoredCandidate) -> bool {
    // RetroCast v0.8.3 model::ScoredCandidate::satisfies_task is intentionally
    // constraint-only; validity is combined separately by satisfies_solv.
    candidate.constraints.status == "pass"
}

fn validate_candidate_ranks(candidates: &[ScoredCandidate]) -> Result<()> {
    for (index, candidate) in candidates.iter().enumerate() {
        if candidate.rank != index + 1 {
            bail!("candidate ranks must be unique, ordered, and contiguous from 1");
        }
    }
    Ok(())
}

fn validate_candidate_profile(
    candidate: &ScoredCandidate,
    acceptable_routes: &[crate::wire::Route],
) -> Result<()> {
    // RetroCast v0.8.3 score_target_owned assigns route slots Tier-0 pass and
    // evaluates constraints; adapter failure slots alone fail Tier 0 and skip constraints.
    if candidate.validity.tiers.len() != 1 || !candidate.validity.tiers.contains_key(&0) {
        bail!("candidate validity evidence must contain exactly Tier 0");
    }
    let tier_zero = candidate
        .validity
        .tiers
        .get(&0)
        .expect("Tier 0 presence checked");
    for result in candidate.validity.tiers.values() {
        validate_check_results(&result.status, &result.checks)?;
    }
    validate_check_results(&candidate.constraints.status, &candidate.constraints.checks)?;
    if let Some(route) = &candidate.route {
        if tier_zero.status != "pass"
            || !tier_zero.checks.is_empty()
            || candidate.constraints.status == "not_evaluated"
        {
            bail!("route candidates must pass Tier 0 and evaluate their constraints");
        }
        match candidate.constraints.status.as_str() {
            "pass" if !candidate.constraints.checks.is_empty() => {
                bail!("passing constraints cannot carry failing checks");
            }
            "fail" if candidate.constraints.checks.is_empty() => {
                bail!("failing constraints must carry evidence");
            }
            _ => {}
        }
        let expected_match = acceptable_prefix_match(route, acceptable_routes);
        if candidate.matched_acceptable_index != expected_match
            || candidate.matches_acceptable != expected_match.is_some()
        {
            bail!("candidate acceptable-route match is not independently reproducible");
        }
    } else if tier_zero.status != "fail"
        || tier_zero.checks.is_empty()
        || candidate.constraints.status != "not_evaluated"
        || !candidate.constraints.checks.is_empty()
        || candidate.matches_acceptable
        || candidate.matched_acceptable_index.is_some()
    {
        bail!(
            "failure candidates must fail Tier 0, leave constraints unevaluated, and not match an acceptable route"
        );
    }
    if let Some(failure) = &candidate.failure {
        if tier_zero.checks.len() != 1
            || tier_zero.checks[0].code != failure.code
            || tier_zero.checks[0].status != "fail"
            || tier_zero.checks[0].message != failure.message
            || tier_zero.checks[0].details != failure.context
        {
            bail!("failure Tier-0 evidence must exactly reflect the failure record");
        }
    }
    Ok(())
}

fn validate_check_results(status: &str, checks: &[crate::wire::CheckResult]) -> Result<()> {
    for check in checks {
        crate::wire::validate_status(&check.status)?;
    }
    match status {
        "pass" if !checks.is_empty() => {
            bail!("passing aggregate status cannot carry checks");
        }
        "fail" if checks.is_empty() || checks.iter().any(|check| check.status != "fail") => {
            bail!("failing aggregate status must contain only failing checks");
        }
        "not_evaluated" if !checks.is_empty() => {
            bail!("not-evaluated aggregate status cannot carry checks");
        }
        _ => {}
    }
    Ok(())
}

fn acceptable_prefix_match(
    candidate: &crate::wire::Route,
    acceptable_routes: &[crate::wire::Route],
) -> Option<usize> {
    // Mirror RetroCast v0.8.3 score::acceptable_match: truncate the candidate at
    // each reference depth and choose the deepest match (last index on a depth tie).
    let candidate_depth = route_depth(&candidate.target);
    let mut best: Option<(usize, usize)> = None;
    let mut signatures = std::collections::BTreeMap::new();
    for (index, reference) in acceptable_routes.iter().enumerate() {
        let reference_depth = route_depth(&reference.target);
        if candidate_depth < reference_depth {
            continue;
        }
        let candidate_signature = signatures
            .entry(reference_depth)
            .or_insert_with(|| route_signature_at_depth(candidate, Some(reference_depth)));
        if *candidate_signature == route_signature_at_depth(reference, None)
            && best.is_none_or(|(_, best_depth)| reference_depth >= best_depth)
        {
            best = Some((index, reference_depth));
        }
    }
    best.map(|(index, _)| index)
}

struct CandidateReuse<'a> {
    id: &'a str,
    prediction_run_id: &'a str,
    target_id: &'a str,
    benchmark_id: &'a str,
    rank: usize,
    route_id: Option<&'a str>,
    failure_code: Option<&'a str>,
    failure_message: Option<&'a str>,
    failure_details: Option<&'a str>,
    metadata: Option<&'a str>,
}

fn assert_candidate_reuse(
    transaction: &Transaction<'_>,
    expected: CandidateReuse<'_>,
) -> Result<()> {
    type CandidateRow = (
        String,
        String,
        String,
        i64,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    );
    let actual: CandidateRow = transaction.query_row(
        "SELECT predictionRunId, targetId, benchmarkSetId, rank, routeId, failureCode, failureMessage, failureDetails, metadata FROM PredictionCandidate WHERE id = ?1",
        [expected.id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?)),
    )?;
    if actual
        != (
            expected.prediction_run_id.to_owned(),
            expected.target_id.to_owned(),
            expected.benchmark_id.to_owned(),
            expected.rank as i64,
            expected.route_id.map(str::to_owned),
            expected.failure_code.map(str::to_owned),
            expected.failure_message.map(str::to_owned),
            expected.failure_details.map(str::to_owned),
            expected.metadata.map(str::to_owned),
        )
    {
        bail!("evaluation candidates differ from the existing prediction run");
    }
    Ok(())
}

fn validity_evidence(candidate: &ScoredCandidate) -> Result<Option<String>> {
    let mut evidence = Map::new();
    if !candidate.validity.reactions.is_empty() {
        evidence.insert("reactions".to_owned(), json!(candidate.validity.reactions));
    }
    for (key, value) in &candidate.validity.extensions {
        let nonempty = match value {
            Value::Null => false,
            Value::Array(items) => !items.is_empty(),
            Value::Object(items) => !items.is_empty(),
            _ => true,
        };
        if nonempty {
            evidence.insert(key.clone(), value.clone());
        }
    }
    Ok((!evidence.is_empty())
        .then(|| serde_json::to_string(&evidence))
        .transpose()?)
}

fn target_stratum(target: &TargetResult) -> Option<String> {
    if let Some(route) = target.target.acceptable_routes.first() {
        return Some(format!("depth {}", route_depth(&route.target)));
    }
    target
        .effective_constraints
        .iter()
        .find(|constraint| {
            constraint.get("kind").and_then(Value::as_str) == Some("retrocast.route_depth")
        })
        .and_then(|constraint| constraint.get("max_depth"))
        .and_then(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .or_else(|| value.as_u64().map(|item| item.to_string()))
        })
        .map(|value| format!("depth {value}"))
}

fn assert_metric(metric: &MetricSummary, expected: f64, count: usize, name: &str) -> Result<()> {
    let tolerance = 1e-12_f64.max(f64::EPSILON * count.max(1) as f64);
    if metric.count != count || (metric.value - expected).abs() > tolerance {
        bail!("{name} disagrees with streamed candidate evaluation");
    }
    Ok(())
}

fn float_eq(left: f64, right: f64) -> bool {
    let scale = left.abs().max(right.abs()).max(1.0);
    (left - right).abs() <= 1e-12_f64.max(f64::EPSILON * 16.0 * scale)
}

fn validate_route_root(
    route: &crate::wire::Route,
    target_id: &str,
    target_smiles: &str,
    target_inchikey: &str,
    label: &str,
) -> Result<()> {
    if route.target.smiles != target_smiles || route.target.inchikey != target_inchikey {
        bail!("{label} root disagrees with enclosing target {target_id}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn prefix_routes() -> (crate::wire::Route, crate::wire::Route) {
        let reference = serde_json::from_value(json!({
            "target": {
                "smiles": "ROOT", "inchikey": "ROOT",
                "product_of": {"reactants": [
                    {"smiles": "MID", "inchikey": "MID", "annotations": {}},
                    {"smiles": "LEAF", "inchikey": "LEAF", "annotations": {}}
                ], "annotations": {}},
                "annotations": {}
            },
            "annotations": {}, "schema_version": "2"
        }))
        .unwrap();
        let candidate = serde_json::from_value(json!({
            "target": {
                "smiles": "ROOT", "inchikey": "ROOT",
                "product_of": {"reactants": [
                    {
                        "smiles": "MID", "inchikey": "MID",
                        "product_of": {"reactants": [
                            {"smiles": "DEEP", "inchikey": "DEEP", "annotations": {}}
                        ], "annotations": {}},
                        "annotations": {}
                    },
                    {"smiles": "LEAF", "inchikey": "LEAF", "annotations": {}}
                ], "annotations": {}},
                "annotations": {}
            },
            "annotations": {}, "schema_version": "2"
        }))
        .unwrap();
        (reference, candidate)
    }

    fn scored_candidate(route: Option<crate::wire::Route>) -> ScoredCandidate {
        serde_json::from_value(if let Some(route) = route {
            json!({
                "rank": 1,
                "route": route,
                "validity": {"tiers": {"0": {"status": "pass", "checks": []}}},
                "constraints": {"status": "pass", "checks": []},
                "matches_acceptable": true,
                "matched_acceptable_index": 0
            })
        } else {
            json!({
                "rank": 1,
                "failure": {"code": "adapter.failure", "context": {}},
                "validity": {"tiers": {"0": {"status": "fail", "checks": [
                    {"code": "adapter.failure", "status": "fail", "details": {}}
                ]}}},
                "constraints": {"status": "not_evaluated", "checks": []},
                "matches_acceptable": false
            })
        })
        .unwrap()
    }

    #[test]
    fn independently_reproduces_retrocast_prefix_match() {
        let (reference, candidate_route) = prefix_routes();
        assert_eq!(
            acceptable_prefix_match(&candidate_route, std::slice::from_ref(&reference)),
            Some(0)
        );
        assert!(
            validate_candidate_profile(
                &scored_candidate(Some(candidate_route)),
                std::slice::from_ref(&reference)
            )
            .is_ok()
        );
    }

    #[test]
    fn rejects_forged_match_and_failure_evidence() {
        let (reference, candidate_route) = prefix_routes();
        let mut forged = scored_candidate(Some(candidate_route));
        forged.matched_acceptable_index = Some(1);
        assert!(validate_candidate_profile(&forged, &[reference]).is_err());

        let mut failure = scored_candidate(None);
        failure.constraints.status = "pass".to_owned();
        assert!(validate_candidate_profile(&failure, &[]).is_err());
        failure.constraints.status = "not_evaluated".to_owned();
        failure.validity.tiers.insert(
            1,
            crate::wire::TierResult {
                status: "pass".to_owned(),
                checks: Vec::new(),
            },
        );
        assert!(validate_candidate_profile(&failure, &[]).is_err());
    }

    #[test]
    fn task_satisfaction_mirrors_retrocast_constraint_only_semantics() {
        let (_, route) = prefix_routes();
        let mut candidate = scored_candidate(Some(route));
        candidate.validity.tiers.get_mut(&0).unwrap().status = "fail".to_owned();
        assert!(satisfies_task(&candidate));
        assert!(validate_candidate_profile(&candidate, &[]).is_err());
    }
}
