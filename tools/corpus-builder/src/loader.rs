use std::{collections::HashMap, fs, path::Path};

use anyhow::{Context, Result, bail};
use rusqlite::{Connection, OptionalExtension, Params, Transaction, params};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::{
    aliases,
    config::CorpusCatalog,
    stock_enrichment,
    stream::{
        parse_hashed_json_gz, resolve_confined_regular, stream_stock_csv,
        stream_stock_enrichment_csv,
    },
    wire::{
        BenchmarkDefinition, Molecule, Reaction, Route, effective_constraints, route_content_hash,
        route_depth, route_is_convergent, route_signature, validate_stock_termination_constraint,
    },
};

pub struct CorpusBindings {
    pub stocks: HashMap<String, String>,
    pub benchmarks: HashMap<String, BenchmarkBinding>,
    pub models: HashMap<String, ModelBinding>,
}

pub struct ModelBinding {
    pub id: String,
    pub instance_slug: String,
}

pub struct BenchmarkBinding {
    pub id: String,
    pub stock: String,
    pub default_constraints: Vec<Value>,
    pub target_constraints: std::collections::BTreeMap<String, Vec<Value>>,
}

pub fn load_reference_data(
    connection: &mut Connection,
    corpus_root: &Path,
    catalog: &CorpusCatalog,
) -> Result<CorpusBindings> {
    let models = load_models(connection, catalog)?;
    let stocks = load_stocks(connection, corpus_root, catalog)?;
    let benchmarks = load_benchmarks(connection, corpus_root, catalog, &stocks)?;
    Ok(CorpusBindings {
        stocks,
        benchmarks,
        models,
    })
}

pub fn load_legacy_url_aliases(
    connection: &mut Connection,
    corpus_root: &Path,
    catalog: &CorpusCatalog,
) -> Result<()> {
    let Some(config) = &catalog.legacy_url_aliases else {
        return Ok(());
    };
    let path = resolve_confined_regular(corpus_root, &config.artifact_path)?;
    let manifest = aliases::read_manifest(&path, &config.artifact_sha256)?;
    let transaction = connection.transaction()?;
    let mut seen_benchmarks = std::collections::HashSet::new();
    for alias in manifest.benchmark_aliases {
        validate_alias(&alias.alias, &alias.reason, &mut seen_benchmarks)?;
        let canonical_collision: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM BenchmarkSet WHERE id = ?1 OR slug = ?1)",
            [&alias.alias],
            |row| row.get(0),
        )?;
        if canonical_collision {
            bail!("benchmark alias collides with a canonical benchmark identifier");
        }
        let benchmark_id: String = transaction
            .query_row(
                "SELECT id FROM BenchmarkSet WHERE slug = ?1",
                [&alias.benchmark_slug],
                |row| row.get(0),
            )
            .with_context(|| {
                format!(
                    "alias references unknown benchmark {}",
                    alias.benchmark_slug
                )
            })?;
        execute_cached(
            &transaction,
            "INSERT INTO BenchmarkUrlAlias (alias, benchmarkSetId, reason) VALUES (?1, ?2, ?3)",
            params![alias.alias, benchmark_id, alias.reason],
        )?;
    }
    let mut seen_runs = std::collections::HashSet::new();
    for alias in manifest.prediction_run_aliases {
        validate_alias(&alias.alias, &alias.reason, &mut seen_runs)?;
        let canonical_collision: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM PredictionRun WHERE id = ?1)",
            [&alias.alias],
            |row| row.get(0),
        )?;
        if canonical_collision {
            bail!("prediction-run alias collides with a canonical run identifier");
        }
        let run_id: String = transaction
            .query_row(
                "SELECT PredictionRun.id FROM PredictionRun JOIN BenchmarkSet ON BenchmarkSet.id = PredictionRun.benchmarkSetId JOIN ModelInstance ON ModelInstance.id = PredictionRun.modelInstanceId WHERE BenchmarkSet.slug = ?1 AND ModelInstance.slug = ?2",
                params![alias.benchmark_slug, alias.model_instance_slug],
                |row| row.get(0),
            )
            .context("prediction-run alias destination is absent or ambiguous")?;
        execute_cached(
            &transaction,
            "INSERT INTO PredictionRunUrlAlias (alias, predictionRunId, reason) VALUES (?1, ?2, ?3)",
            params![alias.alias, run_id, alias.reason],
        )?;
    }
    let mut seen_targets = std::collections::HashSet::new();
    for alias in manifest.benchmark_target_aliases {
        validate_alias(&alias.alias, &alias.reason, &mut seen_targets)?;
        let canonical_collision: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM BenchmarkTarget JOIN BenchmarkSet ON BenchmarkSet.id = BenchmarkTarget.benchmarkSetId WHERE BenchmarkSet.slug = ?1 AND (BenchmarkTarget.id = ?2 OR BenchmarkTarget.targetId = ?2))",
            params![alias.benchmark_slug, alias.alias],
            |row| row.get(0),
        )?;
        if canonical_collision {
            bail!("benchmark-target alias collides with a canonical target identifier");
        }
        let target_id: String = transaction
            .query_row(
                "SELECT BenchmarkTarget.id FROM BenchmarkTarget JOIN BenchmarkSet ON BenchmarkSet.id = BenchmarkTarget.benchmarkSetId WHERE BenchmarkSet.slug = ?1 AND BenchmarkTarget.targetId = ?2",
                params![alias.benchmark_slug, alias.target_id],
                |row| row.get(0),
            )
            .context("benchmark-target alias destination is absent or ambiguous")?;
        execute_cached(
            &transaction,
            "INSERT INTO BenchmarkTargetUrlAlias (alias, benchmarkTargetId, reason) VALUES (?1, ?2, ?3)",
            params![alias.alias, target_id, alias.reason],
        )?;
    }
    transaction.commit()?;
    Ok(())
}

pub fn validate_legacy_url_alias_contract(
    corpus_root: &Path,
    catalog: &CorpusCatalog,
    inventory: &crate::contract::Inventory,
    benchmark_targets: &HashMap<String, std::collections::HashSet<String>>,
) -> Result<()> {
    let Some(config) = &catalog.legacy_url_aliases else {
        return Ok(());
    };
    let path = resolve_confined_regular(corpus_root, &config.artifact_path)?;
    let manifest = aliases::read_manifest(&path, &config.artifact_sha256)?;

    let benchmark_names: std::collections::HashSet<_> = catalog
        .benchmarks
        .iter()
        .map(|value| value.name.as_str())
        .collect();
    let canonical_benchmark_ids: std::collections::HashSet<_> = catalog
        .benchmarks
        .iter()
        .map(|benchmark| benchmark_artifact_sha256(corpus_root, benchmark))
        .collect::<Result<_>>()?;
    let mut seen_benchmarks = std::collections::HashSet::new();
    for alias in manifest.benchmark_aliases {
        validate_alias(&alias.alias, &alias.reason, &mut seen_benchmarks)?;
        if benchmark_names.contains(alias.alias.as_str())
            || canonical_benchmark_ids.contains(&alias.alias)
        {
            bail!("benchmark alias collides with a canonical benchmark identifier");
        }
        if !benchmark_names.contains(alias.benchmark_slug.as_str()) {
            bail!("benchmark alias destination is absent");
        }
    }

    let canonical_runs: std::collections::HashSet<_> = inventory
        .runs
        .iter()
        .map(|run| {
            let model = catalog
                .model(&run.model)
                .expect("inventory model was validated against catalog");
            (run.benchmark.clone(), model.instance_slug.clone())
        })
        .collect();
    let canonical_run_ids: std::collections::HashSet<_> = canonical_runs
        .iter()
        .map(|(benchmark, model)| stable_id("prediction-run", &format!("{benchmark}/{model}")))
        .collect();
    let mut seen_runs = std::collections::HashSet::new();
    for alias in manifest.prediction_run_aliases {
        validate_alias(&alias.alias, &alias.reason, &mut seen_runs)?;
        if canonical_run_ids.contains(&alias.alias) {
            bail!("prediction-run alias collides with a canonical run identifier");
        }
        if !canonical_runs.contains(&(alias.benchmark_slug, alias.model_instance_slug)) {
            bail!("prediction-run alias destination is absent");
        }
    }

    let mut seen_targets = std::collections::HashSet::new();
    for alias in manifest.benchmark_target_aliases {
        validate_alias(&alias.alias, &alias.reason, &mut seen_targets)?;
        let targets = benchmark_targets
            .get(&alias.benchmark_slug)
            .context("benchmark-target alias references an unknown benchmark")?;
        let canonical_id = stable_id(
            "benchmark-target",
            &format!("{}/{}", alias.benchmark_slug, alias.target_id),
        );
        if alias.alias == alias.target_id || alias.alias == canonical_id {
            bail!("benchmark-target alias collides with a canonical target identifier");
        }
        if !targets.contains(&alias.target_id) {
            bail!("benchmark-target alias destination is absent");
        }
    }
    Ok(())
}

fn validate_alias(
    alias: &str,
    reason: &str,
    seen: &mut std::collections::HashSet<String>,
) -> Result<()> {
    if alias.trim().is_empty() || reason.trim().is_empty() || !seen.insert(alias.to_owned()) {
        bail!("legacy URL alias is empty, duplicated, or lacks an audit reason");
    }
    Ok(())
}

fn load_models(
    connection: &mut Connection,
    catalog: &CorpusCatalog,
) -> Result<HashMap<String, ModelBinding>> {
    let transaction = connection.transaction()?;
    let mut bindings = HashMap::new();
    for model in &catalog.models {
        let algorithm_id = stable_id("algorithm", &model.algorithm_slug);
        execute_cached(
            &transaction,
            "INSERT INTO Algorithm (id, name, slug) VALUES (?1, ?2, ?3) ON CONFLICT(slug) DO NOTHING",
            params![algorithm_id, model.algorithm_name, model.algorithm_slug],
        )?;
        let algorithm: (String, String) = transaction.query_row(
            "SELECT id, name FROM Algorithm WHERE slug = ?1",
            [&model.algorithm_slug],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        if algorithm != (algorithm_id.clone(), model.algorithm_name.to_owned()) {
            bail!("algorithm slug reuse disagrees with its stable identity");
        }
        let family_id = stable_id("model-family", &model.family_slug);
        execute_cached(
            &transaction,
            "INSERT INTO ModelFamily (id, algorithmId, name, slug) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(slug) DO NOTHING",
            params![
                family_id,
                algorithm_id,
                model.family_name,
                model.family_slug
            ],
        )?;
        let family: (String, String, String) = transaction.query_row(
            "SELECT id, algorithmId, name FROM ModelFamily WHERE slug = ?1",
            [&model.family_slug],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        if family
            != (
                family_id.clone(),
                algorithm_id.clone(),
                model.family_name.to_owned(),
            )
        {
            bail!("model family slug reuse disagrees with its stable identity");
        }
        let instance_id = stable_id("model-instance", &model.instance_slug);
        execute_cached(
            &transaction,
            "INSERT INTO ModelInstance (id, modelFamilyId, slug, versionMajor, versionMinor, versionPatch, versionPrerelease) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                instance_id,
                family_id,
                model.instance_slug,
                model.version.major,
                model.version.minor,
                model.version.patch,
                model.version.prerelease,
            ],
        )?;
        bindings.insert(
            model.key.clone(),
            ModelBinding {
                id: instance_id,
                instance_slug: model.instance_slug.clone(),
            },
        );
    }
    transaction.commit()?;
    Ok(bindings)
}

fn load_stocks(
    connection: &mut Connection,
    corpus_root: &Path,
    catalog: &CorpusCatalog,
) -> Result<HashMap<String, String>> {
    let mut bindings = HashMap::new();
    for stock in &catalog.stocks {
        let relative = stock.artifact_path.clone();
        let file_path = resolve_confined_regular(corpus_root, &relative)?;
        let manifest_path = resolve_confined_regular(corpus_root, &stock.manifest_path)?;
        let (expected_hash, schema_version) = input_provenance(&manifest_path, &file_path)?;
        let enrichment_binding = stock
            .enrichment
            .as_ref()
            .map(|enrichment| {
                let artifact = resolve_confined_regular(corpus_root, &enrichment.artifact_path)?;
                let manifest_path =
                    resolve_confined_regular(corpus_root, &enrichment.manifest_path)?;
                let manifest = stock_enrichment::validate_manifest(
                    &manifest_path,
                    &enrichment.manifest_sha256,
                    &artifact,
                    &enrichment.artifact_sha256,
                    &stock.name,
                )?;
                Ok::<_, anyhow::Error>((artifact, manifest))
            })
            .transpose()?;
        let transaction = connection.transaction()?;
        let stock_id = stable_id("stock", &stock.name);
        execute_cached(
            &transaction,
            "INSERT INTO Stock (id, name, description, sourcePath, sourceSha256, schemaVersion, enrichmentPath, enrichmentSha256, enrichmentSchemaVersion, enrichmentManifestPath, enrichmentManifestSha256, enrichmentSourceDatabaseSha256) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                stock_id,
                stock.name,
                stock.description,
                relative,
                expected_hash,
                schema_version,
                stock
                    .enrichment
                    .as_ref()
                    .map(|value| value.artifact_path.as_str()),
                stock
                    .enrichment
                    .as_ref()
                    .map(|value| value.artifact_sha256.as_str()),
                stock.enrichment.as_ref().map(|_| "1"),
                stock
                    .enrichment
                    .as_ref()
                    .map(|value| value.manifest_path.as_str()),
                stock
                    .enrichment
                    .as_ref()
                    .map(|value| value.manifest_sha256.as_str()),
                enrichment_binding
                    .as_ref()
                    .map(|(_, manifest)| manifest.source_database_sha256()),
            ],
        )?;
        let mut seen: HashMap<String, String> = HashMap::new();
        let count = stream_stock_csv(&file_path, &expected_hash, |smiles, inchikey| {
            if let Some(existing) = seen.insert(inchikey.to_owned(), smiles.to_owned()) {
                if existing != smiles {
                    bail!(
                        "stock {} assigns multiple SMILES to InChIKey {inchikey}",
                        stock.name
                    );
                }
                return Ok(());
            }
            let molecule_id = ensure_molecule(&transaction, inchikey, smiles)?;
            execute_cached(
                &transaction,
                "INSERT INTO StockItem (id, stockId, moleculeId, smiles) VALUES (?1, ?2, ?3, ?4)",
                params![
                    stable_id("stock-item", &format!("{}/{}", stock.name, inchikey)),
                    stock_id,
                    molecule_id,
                    smiles
                ],
            )?;
            Ok(())
        })?;
        if count == 0 || seen.is_empty() {
            bail!("stock {} has no rows", stock.name);
        }
        if let (Some(enrichment), Some((enrichment_path, manifest))) =
            (&stock.enrichment, &enrichment_binding)
        {
            let mut update = transaction.prepare_cached(
                "UPDATE StockItem SET ppg = ?1, source = ?2, leadTime = ?3, link = ?4 WHERE stockId = ?5 AND moleculeId = (SELECT id FROM Molecule WHERE inchikey = ?6)",
            )?;
            let enrichment_rows =
                stream_stock_enrichment_csv(enrichment_path, &enrichment.artifact_sha256, |row| {
                    let affected = update.execute(params![
                        row.ppg,
                        row.source.as_deref(),
                        row.lead_time.as_deref(),
                        row.link.as_deref(),
                        stock_id,
                        row.inchikey,
                    ])?;
                    if affected != 1 {
                        bail!(
                            "stock enrichment InChIKey must match exactly one {} item",
                            stock.name
                        );
                    }
                    Ok(())
                })?;
            if enrichment_rows != manifest.rows() || enrichment_rows != seen.len() {
                bail!(
                    "stock enrichment must cover every {} item exactly once",
                    stock.name
                );
            }
            drop(update);
        }
        transaction.commit()?;
        bindings.insert(stock.name.clone(), stock_id);
    }
    Ok(bindings)
}

fn load_benchmarks(
    connection: &mut Connection,
    corpus_root: &Path,
    catalog: &CorpusCatalog,
    stocks: &HashMap<String, String>,
) -> Result<HashMap<String, BenchmarkBinding>> {
    let mut bindings = HashMap::new();
    for benchmark in &catalog.benchmarks {
        let relative = benchmark.artifact_path.clone();
        let file_path = resolve_confined_regular(corpus_root, &relative)?;
        let manifest_path = resolve_confined_regular(corpus_root, &benchmark.manifest_path)?;
        let (expected_hash, schema_version) = input_provenance(&manifest_path, &file_path)?;
        let definition: BenchmarkDefinition = parse_hashed_json_gz(&file_path, &expected_hash)?;
        if definition.name != benchmark.name
            || definition.targets.is_empty()
            || definition.schema_version != "2"
            || !definition.extensions.is_empty()
        {
            bail!(
                "benchmark {} definition name or target set is invalid",
                benchmark.name
            );
        }
        if definition
            .stock_name
            .as_deref()
            .is_some_and(|name| name != benchmark.stock)
        {
            bail!("benchmark {} declares an unexpected stock", benchmark.name);
        }
        if definition
            .constraints
            .keys()
            .any(|target_id| !definition.targets.contains_key(target_id))
        {
            bail!(
                "benchmark {} has constraints for an unknown target",
                benchmark.name
            );
        }
        for target_id in definition.targets.keys() {
            validate_stock_termination_constraint(
                &effective_constraints(
                    &definition.default_constraints,
                    &definition.constraints,
                    target_id,
                )?,
                &benchmark.stock,
            )?;
        }
        let acceptable_coverage: Vec<_> = definition
            .targets
            .values()
            .map(|target| !target.acceptable_routes.is_empty())
            .collect();
        let has_acceptable_routes = acceptable_coverage.iter().all(|value| *value);
        if acceptable_coverage.iter().any(|value| *value) != has_acceptable_routes {
            bail!(
                "benchmark {} mixes targets with and without acceptable routes",
                benchmark.name
            );
        }
        let transaction = connection.transaction()?;
        // Benchmark identity is the exact registered artifact, while its
        // readable unique slug is the public URL key.
        let benchmark_id = expected_hash.clone();
        let default_constraints_json = serde_json::to_string(&definition.default_constraints)?;
        let target_constraints_json = serde_json::to_string(&definition.constraints)?;
        execute_cached(
            &transaction,
            "INSERT INTO BenchmarkSet (id, name, slug, description, stockId, hasAcceptableRoutes, sourcePath, sourceSha256, schemaVersion, defaultConstraintsJson, targetConstraintsJson, series, isListed) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1)",
            params![
                benchmark_id,
                benchmark.name,
                definition.description,
                stocks
                    .get(&benchmark.stock)
                    .context("configured stock binding missing")?,
                has_acceptable_routes,
                relative,
                expected_hash,
                schema_version,
                default_constraints_json,
                target_constraints_json,
                benchmark.series,
            ],
        )?;
        for (external_id, target) in definition.targets {
            if target.id != external_id {
                bail!(
                    "benchmark {} target key/id mismatch for {external_id}",
                    benchmark.name
                );
            }
            let molecule_id = ensure_molecule(&transaction, &target.inchikey, &target.smiles)?;
            let target_id = stable_id(
                "benchmark-target",
                &format!("{}/{}", benchmark.name, external_id),
            );
            let metadata = if target.annotations.is_empty() {
                None
            } else {
                Some(serde_json::to_string(&target.annotations)?)
            };
            let (route_length, convergent) = target
                .acceptable_routes
                .first()
                .map(|route| {
                    (
                        Some(route_depth(&route.target) as i64),
                        Some(route_is_convergent(&route.target)),
                    )
                })
                .unwrap_or((None, None));
            execute_cached(
                &transaction,
                "INSERT INTO BenchmarkTarget (id, benchmarkSetId, targetId, moleculeId, smiles, routeLength, isConvergent, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    target_id,
                    benchmark_id,
                    external_id,
                    molecule_id,
                    target.smiles,
                    route_length,
                    convergent,
                    metadata
                ],
            )?;
            for (index, route) in target.acceptable_routes.iter().enumerate() {
                if route.target.smiles != target.smiles || route.target.inchikey != target.inchikey
                {
                    bail!(
                        "benchmark {} acceptable route root disagrees with target {external_id}",
                        benchmark.name
                    );
                }
                let route_id = ensure_route(&transaction, route)?;
                execute_cached(
                    &transaction,
                    "INSERT INTO AcceptableRoute (id, benchmarkTargetId, routeId, routeIndex) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        stable_id("acceptable-route", &format!("{}/{index}", target_id)),
                        target_id,
                        route_id,
                        index as i64
                    ],
                )?;
            }
        }
        transaction.commit()?;
        bindings.insert(
            benchmark.name.to_owned(),
            BenchmarkBinding {
                id: benchmark_id,
                stock: benchmark.stock.clone(),
                default_constraints: definition.default_constraints,
                target_constraints: definition.constraints,
            },
        );
    }
    Ok(bindings)
}

pub(crate) fn input_provenance(
    manifest_path: &Path,
    input_path: &Path,
) -> Result<(String, String)> {
    let manifest: Value = serde_json::from_slice(
        &fs::read(manifest_path).with_context(|| format!("read {}", manifest_path.display()))?,
    )?;
    let schema = manifest
        .get("schema_version")
        .and_then(Value::as_str)
        .context("input manifest schema_version missing")?;
    let outputs = manifest
        .get("output_files")
        .and_then(Value::as_array)
        .context("input manifest output_files missing")?;
    let file_name = input_path
        .file_name()
        .context("input path has no file name")?;
    let matches: Vec<_> = outputs
        .iter()
        .filter(|output| {
            output
                .get("path")
                .and_then(Value::as_str)
                .and_then(|path| Path::new(path).file_name())
                .is_some_and(|name| name == file_name)
        })
        .collect();
    if matches.len() != 1 {
        bail!(
            "input manifest must track exactly one {}",
            input_path.display()
        );
    }
    let hash = matches[0]
        .get("sha256")
        .or_else(|| matches[0].get("file_hash"))
        .and_then(Value::as_str)
        .context("input manifest SHA-256 missing")?
        .to_ascii_lowercase();
    if hash.len() != 64 || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!("invalid input manifest SHA-256");
    }
    Ok((hash, schema.to_owned()))
}

fn benchmark_artifact_sha256(
    corpus_root: &Path,
    benchmark: &crate::config::BenchmarkConfig,
) -> Result<String> {
    let artifact = resolve_confined_regular(corpus_root, &benchmark.artifact_path)?;
    let manifest = resolve_confined_regular(corpus_root, &benchmark.manifest_path)?;
    let (sha256, _) = input_provenance(&manifest, &artifact)?;
    Ok(sha256)
}

pub fn stable_id(namespace: &str, value: &str) -> String {
    let digest = Sha256::digest(format!("syntharena:{namespace}:{value}").as_bytes());
    format!("sa_{:.24x}", digest)
}

pub fn execute_cached<P: Params>(
    transaction: &Transaction<'_>,
    sql: &str,
    params: P,
) -> Result<usize> {
    Ok(transaction.prepare_cached(sql)?.execute(params)?)
}

pub fn ensure_molecule(
    transaction: &Transaction<'_>,
    inchikey: &str,
    smiles: &str,
) -> Result<String> {
    let id = stable_id("molecule", inchikey);
    execute_cached(
        transaction,
        "INSERT INTO Molecule (id, inchikey, smiles) VALUES (?1, ?2, ?3) ON CONFLICT(inchikey) DO NOTHING",
        params![id, inchikey, smiles],
    )?;
    let actual_id: String = transaction.query_row(
        "SELECT id FROM Molecule WHERE inchikey = ?1",
        [inchikey],
        |row| row.get(0),
    )?;
    // InChIKey is the molecule identity. Equivalent source occurrences can retain
    // different SMILES on StockItem/RouteNode without changing the shared molecule ID.
    if actual_id != id {
        bail!("molecule identity reuse disagrees for InChIKey {inchikey}");
    }
    Ok(id)
}

pub fn ensure_route(transaction: &Transaction<'_>, route: &Route) -> Result<String> {
    if route.schema_version != "2" {
        bail!("route schema must be exactly 2");
    }
    let content_hash = route_content_hash(route);
    let route_id = stable_id("route", &content_hash);
    let signature = route_signature(route);
    let length = route_depth(&route.target) as i64;
    let convergent = route_is_convergent(&route.target);
    let inserted = execute_cached(
        transaction,
        "INSERT INTO Route (id, signature, contentHash, length, isConvergent) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(contentHash) DO NOTHING",
        params![route_id, signature, content_hash, length, convergent],
    )?;
    if inserted > 0 {
        insert_route_node(transaction, &route_id, &route.target, None)?;
    }
    let actual: (String, String, i64, bool) = transaction.query_row(
        "SELECT id, signature, length, isConvergent FROM Route WHERE contentHash = ?1",
        [&content_hash],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )?;
    if actual != (route_id.clone(), signature, length, convergent) {
        bail!("route content-hash reuse disagrees with its stable identity");
    }
    Ok(route_id)
}

fn insert_route_node(
    transaction: &Transaction<'_>,
    route_id: &str,
    molecule: &Molecule,
    parent_id: Option<i64>,
) -> Result<i64> {
    let molecule_id = ensure_molecule(transaction, &molecule.inchikey, &molecule.smiles)?;
    let (reaction_step_id, template, metadata) = match molecule.product_of.as_deref() {
        Some(reaction) => {
            let reaction_hash = reaction_topology_hash(reaction, &molecule.inchikey);
            let reaction_id = stable_id("reaction-step", &reaction_hash);
            execute_cached(
                transaction,
                "INSERT INTO ReactionStep (id, reactionHash) VALUES (?1, ?2) ON CONFLICT(reactionHash) DO NOTHING",
                params![reaction_id, reaction_hash],
            )?;
            let actual_id: String = transaction.query_row(
                "SELECT id FROM ReactionStep WHERE reactionHash = ?1",
                [&reaction_hash],
                |row| row.get(0),
            )?;
            if actual_id != reaction_id {
                bail!("reaction hash reuse disagrees with its stable identity");
            }
            let metadata = reaction_metadata(reaction)?;
            (Some(reaction_id), reaction.template.clone(), metadata)
        }
        None => (None, None, None),
    };
    let payload_id = ensure_route_node_payload(
        transaction,
        &molecule_id,
        &molecule.smiles,
        reaction_step_id.as_deref(),
        template.as_deref(),
        metadata.as_deref(),
    )?;
    let node_id = transaction
        .prepare_cached(
            "INSERT INTO RouteNode (routeId, moleculeId, payloadId, parentId, isLeaf) VALUES (?1, ?2, ?3, ?4, ?5)",
        )?
        .insert(params![
            route_id,
            molecule_id,
            payload_id,
            parent_id,
            molecule.product_of.is_none()
        ])?;
    if let Some(reaction) = molecule.product_of.as_deref() {
        for reactant in &reaction.reactants {
            insert_route_node(transaction, route_id, reactant, Some(node_id))?;
        }
    }
    Ok(node_id)
}

fn ensure_route_node_payload(
    transaction: &Transaction<'_>,
    molecule_id: &str,
    smiles: &str,
    reaction_step_id: Option<&str>,
    template: Option<&str>,
    metadata: Option<&str>,
) -> Result<i64> {
    let content_hash = crate::identity::hash_json(&json!([
        molecule_id,
        smiles,
        reaction_step_id,
        template,
        metadata
    ]));
    execute_cached(
        transaction,
        "INSERT INTO RouteNodePayload (contentHash, moleculeId, smiles, reactionStepId, template, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(contentHash) DO NOTHING",
        params![
            content_hash,
            molecule_id,
            smiles,
            reaction_step_id,
            template,
            metadata
        ],
    )?;
    let actual: (i64, String, String, Option<String>, Option<String>, Option<String>) = transaction
        .query_row(
            "SELECT id, moleculeId, smiles, reactionStepId, template, metadata FROM RouteNodePayload WHERE contentHash = ?1",
            [&content_hash],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        )?;
    if actual.1 != molecule_id
        || actual.2 != smiles
        || actual.3.as_deref() != reaction_step_id
        || actual.4.as_deref() != template
        || actual.5.as_deref() != metadata
    {
        bail!("route-node payload hash collision or inconsistent reuse");
    }
    Ok(actual.0)
}

fn reaction_topology_hash(reaction: &Reaction, product_inchikey: &str) -> String {
    let mut reactants: Vec<_> = reaction
        .reactants
        .iter()
        .map(|item| item.inchikey.as_str())
        .collect();
    reactants.sort();
    crate::sha256_bytes(format!("{product_inchikey}>>{}", reactants.join(".")).as_bytes())
}

fn reaction_metadata(reaction: &Reaction) -> Result<Option<String>> {
    let mut metadata = Map::new();
    if let Some(reagents) = &reaction.reagents {
        metadata.insert("reagents".to_owned(), json!(reagents));
    }
    if let Some(solvents) = &reaction.solvents {
        metadata.insert("solvents".to_owned(), json!(solvents));
    }
    if let Some(mapped) = &reaction.mapped_reaction_smiles {
        if !mapped.is_empty() {
            metadata.insert("mapped_reaction_smiles".to_owned(), json!(mapped));
        }
    }
    if !reaction.annotations.is_empty() {
        metadata.insert(
            "annotations".to_owned(),
            Value::Object(reaction.annotations.clone()),
        );
    }
    Ok((!metadata.is_empty())
        .then(|| serde_json::to_string(&metadata))
        .transpose()?)
}

pub fn benchmark_target_binding(
    transaction: &Transaction<'_>,
    benchmark_id: &str,
    external_id: &str,
) -> Result<Option<(String, String, String)>> {
    transaction
        .query_row(
            "SELECT bt.id, bt.smiles, m.inchikey FROM BenchmarkTarget bt JOIN Molecule m ON m.id = bt.moleculeId WHERE bt.benchmarkSetId = ?1 AND bt.targetId = ?2",
            params![benchmark_id, external_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::stable_id;

    #[test]
    fn stable_ids_are_namespaced_deterministic_and_compact() {
        let molecule = stable_id("molecule", "ABC");
        assert_eq!(molecule, stable_id("molecule", "ABC"));
        assert_ne!(molecule, stable_id("route", "ABC"));
        assert_ne!(molecule, stable_id("molecule", "DEF"));
        assert_eq!(molecule.len(), 27);
        assert!(molecule.starts_with("sa_"));
    }
}
