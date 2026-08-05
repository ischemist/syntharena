use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use serde::Serialize;
use serde_json::Value;
use tempfile::Builder as TempBuilder;

use crate::{
    config::{
        self, BenchmarkConfig, CorpusCatalog, ModelConfig, ModelVersion, StockConfig,
        StockEnrichmentConfig,
    },
    contract::{self, Analysis, EvaluationRun, Inventory, InventoryRun},
    stock_enrichment,
    stream::{self, EvaluationSink},
    trust,
    wire::{
        BenchmarkDefinition, EvaluationHeader, TargetResult, effective_constraints,
        validate_stock_termination_constraint,
    },
};

#[derive(Clone, Debug)]
pub struct AddStockOptions {
    pub corpus_root: PathBuf,
    pub name: String,
    pub description: String,
    pub artifact: PathBuf,
    pub manifest: PathBuf,
}

#[derive(Clone, Debug)]
pub struct AddStockEnrichmentOptions {
    pub corpus_root: PathBuf,
    pub stock: String,
    pub artifact: PathBuf,
    pub manifest: PathBuf,
}

#[derive(Clone, Debug)]
pub struct AddBenchmarkOptions {
    pub corpus_root: PathBuf,
    pub stock: String,
    pub series: String,
    pub artifact: PathBuf,
    pub manifest: PathBuf,
}

#[derive(Clone, Debug)]
pub struct AddModelOptions {
    pub corpus_root: PathBuf,
    pub key: String,
    pub algorithm_name: String,
    pub algorithm_slug: String,
    pub family_name: String,
    pub family_slug: String,
    pub instance_slug: String,
    pub version: ModelVersion,
}

#[derive(Clone, Debug)]
pub struct AddRunOptions {
    pub corpus_root: PathBuf,
    pub benchmark: String,
    pub model: String,
    pub bundle: PathBuf,
    pub raw_path: Option<String>,
    pub execution_stats_path: Option<String>,
}

pub fn init_workspace(root: &Path) -> Result<()> {
    fs::create_dir(root).with_context(|| format!("create corpus workspace {}", root.display()))?;
    for relative in ["inputs/stocks", "inputs/benchmarks", "bundles"] {
        fs::create_dir_all(root.join(relative))?;
    }
    write_json_atomic(&root.join("catalog.json"), &CorpusCatalog::empty(), false)?;
    write_json_atomic(&root.join("inventory.json"), &Inventory::empty(), false)?;
    Ok(())
}

pub fn adopt_workspace(root: &Path, catalog_source: &Path) -> Result<()> {
    if !root.is_dir() || root.join("catalog.json").exists() {
        bail!("adopt requires an existing corpus without catalog.json");
    }
    let (catalog, _) = config::load_catalog(catalog_source)?;
    let inventory_path = stream::resolve_confined_regular(root, "inventory.json")?;
    let mut inventory: Inventory = serde_json::from_slice(&fs::read(&inventory_path)?)?;
    for run in &mut inventory.runs {
        run.bundle_path = format!("bundles/{}/{}", run.benchmark, run.model);
        let producer_path = root
            .join("bundles")
            .join(&run.benchmark)
            .join(&run.model)
            .join("producer.json");
        let (evidence, sha256) = contract::load_producer(&producer_path, None)?;
        let observed = evidence.producer();
        if observed.retrocast_version != run.producer.retrocast_version
            || observed.release_tag != run.producer.release_tag
            || observed.release_commit != run.producer.release_commit
        {
            bail!("producer evidence disagrees while adopting {}", run.run_id);
        }
        run.producer_sha256 = sha256;
    }
    inventory.refresh_matrix(&catalog);
    contract::validate_inventory(&inventory, None, &catalog)?;
    validate_workspace_paths(root, &catalog, &inventory)?;
    write_json_atomic(&inventory_path, &inventory, true)?;
    copy_regular_noclobber(catalog_source, &root.join("catalog.json"))
}

pub fn set_coverage(root: &Path, mode: config::CoverageMode) -> Result<()> {
    let (mut catalog, _) = load_workspace(root)?;
    catalog.coverage.mode = mode;
    persist_catalog(root, &catalog)
}

pub fn set_legacy_url_aliases(root: &Path, source: &Path) -> Result<()> {
    let (mut catalog, inventory) = load_workspace(root)?;
    let source_sha256 = stream::sha256_file(source)?;
    let relative = format!("aliases/legacy-url-aliases.{source_sha256}.json.gz");
    copy_regular_noclobber(source, &root.join(&relative))?;
    catalog.legacy_url_aliases = Some(config::LegacyUrlAliasConfig {
        artifact_path: relative.clone(),
        artifact_sha256: source_sha256,
    });
    let mut benchmark_targets = std::collections::HashMap::new();
    for benchmark in &catalog.benchmarks {
        let artifact = stream::resolve_confined_regular(root, &benchmark.artifact_path)?;
        let definition: BenchmarkDefinition = read_json_gz(&artifact)?;
        benchmark_targets.insert(
            benchmark.name.clone(),
            definition.targets.keys().cloned().collect::<HashSet<_>>(),
        );
    }
    if let Err(error) = crate::loader::validate_legacy_url_alias_contract(
        root,
        &catalog,
        &inventory,
        &benchmark_targets,
    ) {
        let _ = fs::remove_file(root.join(&relative));
        return Err(error);
    }
    if let Err(error) = persist_catalog(root, &catalog) {
        let _ = fs::remove_file(root.join(&relative));
        return Err(error);
    }
    Ok(())
}

pub fn set_producer_trust(root: &Path, source: &Path) -> Result<()> {
    let (mut catalog, _) = load_workspace(root)?;
    let policy_sha256 = stream::sha256_file(source)?;
    let relative = format!("trust/producer-policy.{policy_sha256}.json");
    copy_regular_noclobber(source, &root.join(&relative))?;
    if let Err(error) = trust::load_policy(&root.join(&relative), &policy_sha256) {
        let _ = fs::remove_file(root.join(&relative));
        return Err(error);
    }
    catalog.producer_trust = Some(config::ProducerTrustConfig {
        policy_path: relative.clone(),
        policy_sha256,
    });
    if let Err(error) = persist_catalog(root, &catalog) {
        let _ = fs::remove_file(root.join(&relative));
        return Err(error);
    }
    Ok(())
}

pub fn add_stock(options: AddStockOptions) -> Result<()> {
    config::validate_key("stock name", &options.name)?;
    let (mut catalog, _) = load_workspace(&options.corpus_root)?;
    if catalog.stock(&options.name).is_some() {
        bail!("stock already exists: {}", options.name);
    }
    let artifact_relative = format!("inputs/stocks/{}.csv.gz", options.name);
    let manifest_relative = format!("inputs/stocks/{}.manifest.json", options.name);
    copy_regular_noclobber(
        &options.artifact,
        &options.corpus_root.join(&artifact_relative),
    )?;
    if let Err(error) = copy_regular_noclobber(
        &options.manifest,
        &options.corpus_root.join(&manifest_relative),
    ) {
        let _ = fs::remove_file(options.corpus_root.join(&artifact_relative));
        return Err(error);
    }
    if let Err(error) = validate_stock_artifact(
        &options.corpus_root.join(&artifact_relative),
        &options.corpus_root.join(&manifest_relative),
    ) {
        let _ = fs::remove_file(options.corpus_root.join(&artifact_relative));
        let _ = fs::remove_file(options.corpus_root.join(&manifest_relative));
        return Err(error);
    }
    catalog.stocks.push(StockConfig {
        name: options.name,
        description: options.description,
        artifact_path: artifact_relative.clone(),
        manifest_path: manifest_relative.clone(),
        enrichment: None,
    });
    catalog
        .stocks
        .sort_by(|left, right| left.name.cmp(&right.name));
    if let Err(error) = persist_catalog(&options.corpus_root, &catalog) {
        let _ = fs::remove_file(options.corpus_root.join(&artifact_relative));
        let _ = fs::remove_file(options.corpus_root.join(&manifest_relative));
        return Err(error);
    }
    Ok(())
}

pub fn add_stock_enrichment(options: AddStockEnrichmentOptions) -> Result<()> {
    let (mut catalog, _) = load_workspace(&options.corpus_root)?;
    let stock = catalog
        .stock(&options.stock)
        .with_context(|| format!("stock is not registered: {}", options.stock))?;
    if stock.enrichment.is_some() {
        bail!("stock enrichment already exists: {}", options.stock);
    }

    let artifact_sha256 = stream::sha256_file(&options.artifact)?;
    let manifest_sha256 = stream::sha256_file(&options.manifest)?;
    let manifest = stock_enrichment::validate_manifest(
        &options.manifest,
        &manifest_sha256,
        &options.artifact,
        &artifact_sha256,
        &options.stock,
    )?;

    let stock_artifact =
        stream::resolve_confined_regular(&options.corpus_root, &stock.artifact_path)?;
    let stock_manifest =
        stream::resolve_confined_regular(&options.corpus_root, &stock.manifest_path)?;
    let (stock_sha256, _) = crate::loader::input_provenance(&stock_manifest, &stock_artifact)?;
    let mut members = HashSet::new();
    stream::stream_stock_csv(&stock_artifact, &stock_sha256, |_smiles, inchikey| {
        members.insert(inchikey.to_owned());
        Ok(())
    })?;
    let expected_members = members.len();
    let rows = stream::stream_stock_enrichment_csv(&options.artifact, &artifact_sha256, |row| {
        if !members.remove(&row.inchikey) {
            bail!(
                "stock enrichment contains an InChIKey outside {} or a duplicate",
                options.stock
            );
        }
        Ok(())
    })?;
    if rows != manifest.rows() || rows != expected_members || !members.is_empty() {
        bail!(
            "stock enrichment must contain exactly one row for every {} member",
            options.stock
        );
    }

    let artifact_relative = format!("inputs/stocks/{}.enrichment.csv.gz", options.stock);
    let manifest_relative = format!("inputs/stocks/{}.enrichment.manifest.json", options.stock);
    let artifact_destination = options.corpus_root.join(&artifact_relative);
    let manifest_destination = options.corpus_root.join(&manifest_relative);
    let copied_artifact = copy_or_use_canonical(&options.artifact, &artifact_destination)?;
    let copied_manifest = match copy_or_use_canonical(&options.manifest, &manifest_destination) {
        Ok(copied) => copied,
        Err(error) => {
            if copied_artifact {
                let _ = fs::remove_file(&artifact_destination);
            }
            return Err(error);
        }
    };

    let stock = catalog
        .stocks
        .iter_mut()
        .find(|stock| stock.name == options.stock)
        .expect("registered stock remains in catalog");
    stock.enrichment = Some(StockEnrichmentConfig {
        artifact_path: artifact_relative,
        artifact_sha256,
        manifest_path: manifest_relative,
        manifest_sha256,
    });
    if let Err(error) = persist_catalog(&options.corpus_root, &catalog) {
        if copied_artifact {
            let _ = fs::remove_file(&artifact_destination);
        }
        if copied_manifest {
            let _ = fs::remove_file(&manifest_destination);
        }
        return Err(error);
    }
    Ok(())
}

pub fn add_benchmark(options: AddBenchmarkOptions) -> Result<()> {
    let (mut catalog, _) = load_workspace(&options.corpus_root)?;
    if catalog.stock(&options.stock).is_none() {
        bail!("benchmark stock is not registered: {}", options.stock);
    }
    let definition: BenchmarkDefinition = read_json_gz(&options.artifact)?;
    config::validate_key("benchmark name", &definition.name)?;
    if catalog.benchmark(&definition.name).is_some() {
        bail!("benchmark already exists: {}", definition.name);
    }
    let series = options.series.to_ascii_uppercase();
    if !matches!(series.as_str(), "MARKET" | "REFERENCE" | "LEGACY" | "OTHER") {
        bail!("benchmark series must be market, reference, legacy, or other");
    }
    let artifact_relative = format!("inputs/benchmarks/{}.json.gz", definition.name);
    let manifest_relative = format!("inputs/benchmarks/{}.manifest.json", definition.name);
    copy_regular_noclobber(
        &options.artifact,
        &options.corpus_root.join(&artifact_relative),
    )?;
    if let Err(error) = copy_regular_noclobber(
        &options.manifest,
        &options.corpus_root.join(&manifest_relative),
    ) {
        let _ = fs::remove_file(options.corpus_root.join(&artifact_relative));
        return Err(error);
    }
    if let Err(error) = validate_benchmark_artifact(
        &options.corpus_root.join(&artifact_relative),
        &options.corpus_root.join(&manifest_relative),
        &definition.name,
        &options.stock,
    ) {
        let _ = fs::remove_file(options.corpus_root.join(&artifact_relative));
        let _ = fs::remove_file(options.corpus_root.join(&manifest_relative));
        return Err(error);
    }
    catalog.benchmarks.push(BenchmarkConfig {
        name: definition.name,
        stock: options.stock,
        series,
        artifact_path: artifact_relative.clone(),
        manifest_path: manifest_relative.clone(),
    });
    catalog
        .benchmarks
        .sort_by(|left, right| left.name.cmp(&right.name));
    if let Err(error) = persist_catalog(&options.corpus_root, &catalog) {
        let _ = fs::remove_file(options.corpus_root.join(&artifact_relative));
        let _ = fs::remove_file(options.corpus_root.join(&manifest_relative));
        return Err(error);
    }
    Ok(())
}

pub fn add_model(options: AddModelOptions) -> Result<()> {
    let (mut catalog, _) = load_workspace(&options.corpus_root)?;
    let model = ModelConfig {
        key: options.key,
        algorithm_name: options.algorithm_name,
        algorithm_slug: options.algorithm_slug,
        family_name: options.family_name,
        family_slug: options.family_slug,
        instance_slug: options.instance_slug,
        version: options.version,
    };
    catalog.models.push(model);
    catalog
        .models
        .sort_by(|left, right| left.key.cmp(&right.key));
    config::validate_catalog(&catalog)?;
    persist_catalog(&options.corpus_root, &catalog)
}

pub fn add_run(options: AddRunOptions) -> Result<()> {
    let (catalog, mut inventory) = load_workspace(&options.corpus_root)?;
    let trust_policy = trust::load_workspace_policy(
        &options.corpus_root,
        catalog
            .producer_trust
            .as_ref()
            .context("register a producer trust policy before adding runs")?,
    )?;
    let benchmark = catalog
        .benchmark(&options.benchmark)
        .context("run benchmark is not registered")?;
    if catalog.model(&options.model).is_none() {
        bail!("run model is not registered: {}", options.model);
    }
    let run_id = format!("{}/{}", options.benchmark, options.model);
    if inventory.runs.iter().any(|run| run.run_id == run_id) {
        bail!("run already exists: {run_id}");
    }
    let destination = options
        .corpus_root
        .join("bundles")
        .join(&options.benchmark)
        .join(&options.model);
    copy_directory_noclobber(&options.bundle, &destination)?;
    let result = inspect_run(InspectRunOptions {
        corpus_root: &options.corpus_root,
        benchmark: benchmark.name.as_str(),
        stock: benchmark.stock.as_str(),
        model: options.model.as_str(),
        raw_override: options.raw_path.as_deref(),
        execution_override: options.execution_stats_path.as_deref(),
        verify_registration_evidence: true,
        trust_policy: &trust_policy,
    });
    let entry = match result {
        Ok(entry) => entry,
        Err(error) => {
            let _ = fs::remove_dir_all(&destination);
            return Err(error);
        }
    };
    inventory.runs.push(entry);
    inventory
        .runs
        .sort_by(|left, right| left.run_id.cmp(&right.run_id));
    inventory.refresh_matrix(&catalog);
    contract::validate_inventory(&inventory, None, &catalog)?;
    if let Err(error) = write_json_atomic(
        &options.corpus_root.join("inventory.json"),
        &inventory,
        true,
    ) {
        let _ = fs::remove_dir_all(&destination);
        return Err(error);
    }
    Ok(())
}

pub fn validate_workspace(root: &Path) -> Result<()> {
    let catalog_path = stream::resolve_confined_regular(root, "catalog.json")?;
    let (catalog, _) = config::load_catalog(&catalog_path)?;
    let inventory_path = stream::resolve_confined_regular(root, "inventory.json")?;
    let (inventory, _) = contract::load_inventory(&inventory_path, None, &catalog)?;
    validate_workspace_paths(root, &catalog, &inventory)?;
    let mut benchmark_targets = std::collections::HashMap::new();
    for stock in &catalog.stocks {
        let artifact = stream::resolve_confined_regular(root, &stock.artifact_path)?;
        let manifest = stream::resolve_confined_regular(root, &stock.manifest_path)?;
        validate_stock_artifact(&artifact, &manifest)?;
        if let Some(enrichment) = &stock.enrichment {
            validate_stock_enrichment(root, stock, enrichment)?;
        }
    }
    for benchmark in &catalog.benchmarks {
        let artifact = stream::resolve_confined_regular(root, &benchmark.artifact_path)?;
        let manifest = stream::resolve_confined_regular(root, &benchmark.manifest_path)?;
        validate_benchmark_artifact(&artifact, &manifest, &benchmark.name, &benchmark.stock)?;
        let definition: BenchmarkDefinition = read_json_gz(&artifact)?;
        benchmark_targets.insert(
            benchmark.name.clone(),
            definition.targets.keys().cloned().collect::<HashSet<_>>(),
        );
    }
    if !inventory.runs.is_empty() {
        let trust_policy = trust::load_workspace_policy(
            root,
            catalog
                .producer_trust
                .as_ref()
                .context("corpus has runs but no producer trust policy")?,
        )?;
        for registered in &inventory.runs {
            let observed = inspect_run(InspectRunOptions {
                corpus_root: root,
                benchmark: &registered.benchmark,
                stock: &registered.stock,
                model: &registered.model,
                raw_override: Some(&registered.raw_path),
                execution_override: Some(&registered.execution_stats_path),
                verify_registration_evidence: false,
                trust_policy: &trust_policy,
            })?;
            let observed_value = serde_json::to_value(&observed)?;
            let registered_value = serde_json::to_value(registered)?;
            if observed_value != registered_value {
                let changed_fields = changed_object_fields(&registered_value, &observed_value);
                bail!(
                    "registered run evidence changed after registration: {} ({})",
                    registered.run_id,
                    changed_fields.join(", ")
                );
            }
        }
    }
    crate::loader::validate_legacy_url_alias_contract(
        root,
        &catalog,
        &inventory,
        &benchmark_targets,
    )
}

fn changed_object_fields(expected: &Value, observed: &Value) -> Vec<String> {
    let (Some(expected), Some(observed)) = (expected.as_object(), observed.as_object()) else {
        return vec!["<root>".to_owned()];
    };
    expected
        .keys()
        .chain(observed.keys())
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .filter(|key| expected.get(*key) != observed.get(*key))
        .cloned()
        .collect()
}

fn validate_workspace_paths(
    root: &Path,
    catalog: &CorpusCatalog,
    inventory: &Inventory,
) -> Result<()> {
    for stock in &catalog.stocks {
        stream::resolve_confined_regular(root, &stock.artifact_path)?;
        stream::resolve_confined_regular(root, &stock.manifest_path)?;
        if let Some(enrichment) = &stock.enrichment {
            let artifact = stream::resolve_confined_regular(root, &enrichment.artifact_path)?;
            let manifest = stream::resolve_confined_regular(root, &enrichment.manifest_path)?;
            let validated = stock_enrichment::validate_manifest(
                &manifest,
                &enrichment.manifest_sha256,
                &artifact,
                &enrichment.artifact_sha256,
                &stock.name,
            )?;
            let rows = stream::stream_stock_enrichment_csv(
                &artifact,
                &enrichment.artifact_sha256,
                |_row| Ok(()),
            )?;
            if rows != validated.rows() {
                bail!("stock enrichment row count disagrees with its manifest");
            }
        }
    }
    for benchmark in &catalog.benchmarks {
        stream::resolve_confined_regular(root, &benchmark.artifact_path)?;
        stream::resolve_confined_regular(root, &benchmark.manifest_path)?;
    }
    for run in &inventory.runs {
        let manifest = format!("bundles/{}/{}/manifest.json", run.benchmark, run.model);
        stream::resolve_confined_regular(root, &manifest)?;
    }
    if let Some(aliases) = &catalog.legacy_url_aliases {
        stream::resolve_confined_regular(root, &aliases.artifact_path)?;
    }
    if let Some(trust) = &catalog.producer_trust {
        stream::resolve_confined_regular(root, &trust.policy_path)?;
    }
    Ok(())
}

fn load_workspace(root: &Path) -> Result<(CorpusCatalog, Inventory)> {
    let catalog_path = stream::resolve_confined_regular(root, "catalog.json")?;
    let (catalog, _) = config::load_catalog(&catalog_path)?;
    let inventory_path = stream::resolve_confined_regular(root, "inventory.json")?;
    let bytes = fs::read(&inventory_path)?;
    let inventory: Inventory = serde_json::from_slice(&bytes)?;
    contract::validate_inventory(&inventory, None, &catalog)?;
    Ok((catalog, inventory))
}

fn persist_catalog(root: &Path, catalog: &CorpusCatalog) -> Result<()> {
    config::validate_catalog(catalog)?;
    write_json_atomic(&root.join("catalog.json"), catalog, true)
}

struct InspectRunOptions<'a> {
    corpus_root: &'a Path,
    benchmark: &'a str,
    stock: &'a str,
    model: &'a str,
    raw_override: Option<&'a str>,
    execution_override: Option<&'a str>,
    verify_registration_evidence: bool,
    trust_policy: &'a trust::ProducerTrustPolicy,
}

fn inspect_run(options: InspectRunOptions<'_>) -> Result<InventoryRun> {
    let InspectRunOptions {
        corpus_root,
        benchmark,
        stock,
        model,
        raw_override,
        execution_override,
        verify_registration_evidence,
        trust_policy,
    } = options;
    let bundle_relative = Path::new("bundles").join(benchmark).join(model);
    let bundle_root = corpus_root.join(&bundle_relative);
    let manifest_path = bundle_root.join("manifest.json");
    let manifest_sha256 = crate::sha256_bytes(&fs::read(&manifest_path)?);
    let (manifest, _) = contract::load_manifest(&manifest_path, &manifest_sha256)?;
    if verify_registration_evidence {
        verify_manifest_sources(&bundle_root, &manifest)?;
    }
    let producer_path = bundle_root.join("producer.json");
    let (producer_evidence, producer_sha256) = contract::load_producer(&producer_path, None)?;
    trust::validate_producer(trust_policy, &producer_evidence)?;
    if verify_registration_evidence {
        verify_producer_executable(&producer_evidence)?;
    }
    let adapter = manifest
        .parameters
        .get("adapter")
        .and_then(Value::as_str)
        .context("bundle manifest parameter adapter is missing")?
        .to_owned();
    let candidates_info = contract::tracked_output(&manifest, "candidates.json.gz")?;
    let evaluation_info = contract::tracked_output(&manifest, "evaluation.json.gz")?;
    let analysis_info = contract::tracked_output(&manifest, "analysis.json.gz")?;
    let evaluation_run_info = contract::tracked_output(&manifest, "evaluation-run.json")?;
    let candidates_path = stream::resolve_confined_regular(&bundle_root, &candidates_info.path)?;
    let evaluation_path = stream::resolve_confined_regular(&bundle_root, &evaluation_info.path)?;
    let analysis_path = stream::resolve_confined_regular(&bundle_root, &analysis_info.path)?;
    let evaluation_run_path =
        stream::resolve_confined_regular(&bundle_root, &evaluation_run_info.path)?;
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
    let (candidate_targets, candidate_count) = {
        let (digests, count) =
            stream::stream_candidate_digests(&candidates_path, &candidates_info.sha256)?;
        (digests.len(), count)
    };
    let mut counter = CountSink::default();
    stream::stream_evaluation(&evaluation_path, &evaluation_info.sha256, &mut counter)?;
    if counter.benchmark.as_deref() != Some(benchmark)
        || counter.stock.as_deref() != Some(stock)
        || counter.targets != candidate_targets
        || counter.candidates != candidate_count
    {
        bail!("bundle task, stock, or candidate counts disagree with its catalog binding");
    }
    let analysis: Analysis = stream::parse_hashed_json_gz(&analysis_path, &analysis_info.sha256)?;
    let runtime: EvaluationRun =
        read_hashed_json(&evaluation_run_path, &evaluation_run_info.sha256)?;
    let tier_0_validity_rate = analysis
        .metrics
        .get("tier_0_validity_rate")
        .context("analysis lacks tier_0_validity_rate")?
        .clone();
    let solv_0_rate_key = format!("solv_0[{stock}]_rate");
    let solv_0_rate = analysis
        .metrics
        .get(&solv_0_rate_key)
        .with_context(|| format!("analysis lacks {solv_0_rate_key}"))?
        .clone();
    let (raw_path, raw_sha256) = source_binding(
        &manifest,
        raw_override,
        |path| !is_execution_stats(path) && is_probable_raw_result(path),
        "raw planner result",
    )?;
    let (execution_stats_path, execution_stats_sha256) = source_binding(
        &manifest,
        execution_override,
        is_execution_stats,
        "execution statistics",
    )?;
    Ok(InventoryRun {
        run_id: format!("{benchmark}/{model}"),
        model: model.to_owned(),
        adapter,
        benchmark: benchmark.to_owned(),
        stock: stock.to_owned(),
        bundle_path: bundle_relative.to_string_lossy().into_owned(),
        raw_path,
        raw_sha256,
        execution_stats_path,
        execution_stats_sha256,
        status: "completed".to_owned(),
        strict_manifest_verified: true,
        manifest_sha256,
        producer_sha256,
        targets: counter.targets,
        expected_targets: counter.targets,
        candidates: counter.candidates,
        routes: counter.routes,
        failures: counter.failures,
        tier_0_validity_rate,
        solv_0_rate,
        solv_0_rate_key,
        producer: producer_evidence.producer(),
        runtime,
    })
}

fn verify_manifest_sources(bundle_root: &Path, manifest: &contract::Manifest) -> Result<()> {
    for source in &manifest.source_files {
        let declared = Path::new(&source.path);
        let path = if declared.is_absolute() {
            declared.to_owned()
        } else {
            bundle_root.join(declared)
        };
        if !path.is_file() {
            bail!(
                "manifest source is unavailable during registration: {}",
                path.display()
            );
        }
        let actual = stream::sha256_file(&path)?;
        if !actual.eq_ignore_ascii_case(&source.sha256) {
            bail!("manifest source SHA-256 mismatch: {}", path.display());
        }
    }
    Ok(())
}

fn verify_producer_executable(evidence: &contract::ProducerEvidence) -> Result<()> {
    let executable = Path::new(&evidence.executable_path);
    if !executable.is_file() {
        bail!(
            "producer executable is unavailable during registration: {}",
            executable.display()
        );
    }
    let actual = stream::sha256_file(executable)?;
    if actual != evidence.executable_sha256 {
        bail!("producer executable SHA-256 mismatch");
    }
    Ok(())
}

#[derive(Default)]
struct CountSink {
    benchmark: Option<String>,
    stock: Option<String>,
    targets: usize,
    candidates: usize,
    routes: usize,
    failures: usize,
}

impl EvaluationSink for CountSink {
    fn begin(&mut self, header: &EvaluationHeader) -> Result<()> {
        if header.tiers != [0] {
            bail!("only Tier-0 evaluation bundles are supported");
        }
        self.benchmark = Some(header.task_name.clone());
        self.stock = Some(header.metric_label.clone());
        Ok(())
    }

    fn target(&mut self, _target_id: &str, target: TargetResult) -> Result<()> {
        self.targets += 1;
        self.candidates += target.candidates.len();
        self.failures += target
            .candidates
            .iter()
            .filter(|candidate| candidate.failure.is_some())
            .count();
        self.routes += target
            .candidates
            .iter()
            .filter(|candidate| candidate.route.is_some())
            .count();
        Ok(())
    }

    fn finish(&mut self, schema_version: &str) -> Result<()> {
        if schema_version != "2" {
            bail!("evaluation schema must be exactly 2");
        }
        Ok(())
    }
}

fn source_binding<F>(
    manifest: &contract::Manifest,
    override_path: Option<&str>,
    predicate: F,
    label: &str,
) -> Result<(String, String)>
where
    F: Fn(&str) -> bool,
{
    let matches: Vec<_> = manifest
        .source_files
        .iter()
        .filter(|file| {
            override_path.map_or_else(|| predicate(&file.path), |path| file.path == path)
        })
        .collect();
    if matches.len() != 1 {
        bail!("bundle manifest must identify exactly one {label}; pass an explicit path override");
    }
    Ok((
        matches[0].path.clone(),
        matches[0].sha256.to_ascii_lowercase(),
    ))
}

fn is_execution_stats(path: &str) -> bool {
    let name = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.contains("execution") && name.contains("stat")
}

fn is_probable_raw_result(path: &str) -> bool {
    let name = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.contains("route") || name.contains("candidate") || name.contains("result")
}

fn read_json_gz<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let file = fs::File::open(path)?;
    Ok(serde_json::from_reader(flate2::read::GzDecoder::new(file))?)
}

fn validate_stock_artifact(artifact: &Path, manifest: &Path) -> Result<()> {
    let (expected, _schema) = crate::loader::input_provenance(manifest, artifact)?;
    let rows = stream::stream_stock_csv(artifact, &expected, |_smiles, _inchikey| Ok(()))?;
    if rows == 0 {
        bail!("stock artifact is empty");
    }
    Ok(())
}

fn validate_stock_enrichment(
    root: &Path,
    stock: &StockConfig,
    enrichment: &StockEnrichmentConfig,
) -> Result<()> {
    let artifact = stream::resolve_confined_regular(root, &enrichment.artifact_path)?;
    let manifest_path = stream::resolve_confined_regular(root, &enrichment.manifest_path)?;
    let manifest = stock_enrichment::validate_manifest(
        &manifest_path,
        &enrichment.manifest_sha256,
        &artifact,
        &enrichment.artifact_sha256,
        &stock.name,
    )?;
    let stock_artifact = stream::resolve_confined_regular(root, &stock.artifact_path)?;
    let stock_manifest = stream::resolve_confined_regular(root, &stock.manifest_path)?;
    let (stock_sha256, _) = crate::loader::input_provenance(&stock_manifest, &stock_artifact)?;
    let mut members = HashSet::new();
    stream::stream_stock_csv(&stock_artifact, &stock_sha256, |_smiles, inchikey| {
        members.insert(inchikey.to_owned());
        Ok(())
    })?;
    let expected = members.len();
    let rows =
        stream::stream_stock_enrichment_csv(&artifact, &enrichment.artifact_sha256, |row| {
            if !members.remove(&row.inchikey) {
                bail!("stock enrichment has an unknown or duplicate InChIKey");
            }
            Ok(())
        })?;
    if rows != expected || rows != manifest.rows() || !members.is_empty() {
        bail!("stock enrichment does not exactly cover its stock");
    }
    Ok(())
}

fn validate_benchmark_artifact(
    artifact: &Path,
    manifest: &Path,
    name: &str,
    stock: &str,
) -> Result<()> {
    let (expected, schema) = crate::loader::input_provenance(manifest, artifact)?;
    if schema != "2" {
        bail!("benchmark manifest schema must be exactly 2");
    }
    let definition: BenchmarkDefinition = stream::parse_hashed_json_gz(artifact, &expected)?;
    if definition.name != name || definition.schema_version != "2" || definition.targets.is_empty()
    {
        bail!("benchmark artifact identity or target set is invalid");
    }
    if definition
        .stock_name
        .as_deref()
        .is_some_and(|declared| declared != stock)
    {
        bail!("benchmark artifact declares a different stock");
    }
    for target_id in definition.targets.keys() {
        validate_stock_termination_constraint(
            &effective_constraints(
                &definition.default_constraints,
                &definition.constraints,
                target_id,
            )?,
            stock,
        )?;
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

fn copy_regular_noclobber(source: &Path, destination: &Path) -> Result<()> {
    if !source.is_file() {
        bail!("source is not a regular file: {}", source.display());
    }
    if destination.exists() {
        bail!("destination already exists: {}", destination.display());
    }
    let parent = destination.parent().context("destination has no parent")?;
    fs::create_dir_all(parent)?;
    let temporary = TempBuilder::new()
        .prefix(".corpus-copy-")
        .tempfile_in(parent)?;
    let temporary_path = temporary.path().to_owned();
    fs::copy(source, &temporary_path)?;
    temporary.persist_noclobber(destination)?;
    Ok(())
}

fn copy_or_use_canonical(source: &Path, destination: &Path) -> Result<bool> {
    if destination.exists() {
        if source.canonicalize()? == destination.canonicalize()? {
            return Ok(false);
        }
        bail!("destination already exists: {}", destination.display());
    }
    copy_regular_noclobber(source, destination)?;
    Ok(true)
}

fn copy_directory_noclobber(source: &Path, destination: &Path) -> Result<()> {
    if !source.is_dir() || destination.exists() {
        bail!("bundle source must be a directory and destination must not exist");
    }
    let parent = destination
        .parent()
        .context("bundle destination has no parent")?;
    fs::create_dir_all(parent)?;
    let temporary = TempBuilder::new()
        .prefix(".corpus-bundle-")
        .tempdir_in(parent)?;
    copy_directory_contents(source, temporary.path())?;
    let temporary_path = temporary.keep();
    if let Err(error) = fs::rename(&temporary_path, destination) {
        let _ = fs::remove_dir_all(&temporary_path);
        return Err(error.into());
    }
    Ok(())
}

fn copy_directory_contents(source: &Path, destination: &Path) -> Result<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let output = destination.join(entry.file_name());
        if file_type.is_symlink() {
            bail!(
                "bundle directories may not contain symlinks: {}",
                entry.path().display()
            );
        } else if file_type.is_dir() {
            fs::create_dir(&output)?;
            copy_directory_contents(&entry.path(), &output)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), output)?;
        } else {
            bail!(
                "bundle contains a non-file entry: {}",
                entry.path().display()
            );
        }
    }
    Ok(())
}

fn write_json_atomic<T: Serialize>(path: &Path, value: &T, replace: bool) -> Result<()> {
    if !replace && path.exists() {
        bail!("path already exists: {}", path.display());
    }
    let parent = path.parent().context("JSON destination has no parent")?;
    fs::create_dir_all(parent)?;
    let mut bytes = serde_json::to_vec_pretty(value)?;
    bytes.push(b'\n');
    let temporary = TempBuilder::new()
        .prefix(".corpus-json-")
        .tempfile_in(parent)?;
    fs::write(temporary.path(), bytes)?;
    if replace {
        let temporary_path = temporary.into_temp_path();
        fs::rename(&temporary_path, path)?;
    } else {
        temporary.persist_noclobber(path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_creates_an_empty_valid_workspace() {
        let parent = tempfile::tempdir().unwrap();
        let root = parent.path().join("corpus");
        init_workspace(&root).unwrap();
        validate_workspace(&root).unwrap();
    }
}
