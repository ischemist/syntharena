use std::{collections::HashMap, fs, path::Path};

use anyhow::{Context, Result, bail};
use rusqlite::{Connection, OptionalExtension, Params, Transaction, params};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::{
    config::{BENCHMARKS, MODELS, STOCKS},
    stream::{parse_hashed_json_gz, resolve_confined_regular, stream_stock_csv},
    wire::{
        BenchmarkDefinition, Molecule, Reaction, Route, effective_constraints, route_content_hash,
        route_depth, route_is_convergent, route_signature, validate_stock_termination_constraint,
    },
};

pub struct CorpusBindings {
    pub stocks: HashMap<String, String>,
    pub benchmarks: HashMap<String, BenchmarkBinding>,
    pub models: HashMap<String, String>,
}

pub struct BenchmarkBinding {
    pub id: String,
    pub default_constraints: Vec<Value>,
    pub target_constraints: std::collections::BTreeMap<String, Vec<Value>>,
}

pub fn load_reference_data(
    connection: &mut Connection,
    corpus_root: &Path,
) -> Result<CorpusBindings> {
    let models = load_models(connection)?;
    let stocks = load_stocks(connection, corpus_root)?;
    let benchmarks = load_benchmarks(connection, corpus_root, &stocks)?;
    Ok(CorpusBindings {
        stocks,
        benchmarks,
        models,
    })
}

fn load_models(connection: &mut Connection) -> Result<HashMap<String, String>> {
    let transaction = connection.transaction()?;
    let mut bindings = HashMap::new();
    for model in MODELS {
        let algorithm_id = stable_id("algorithm", model.algorithm_slug);
        execute_cached(
            &transaction,
            "INSERT INTO Algorithm (id, name, slug) VALUES (?1, ?2, ?3) ON CONFLICT(slug) DO NOTHING",
            params![algorithm_id, model.algorithm_name, model.algorithm_slug],
        )?;
        let algorithm: (String, String) = transaction.query_row(
            "SELECT id, name FROM Algorithm WHERE slug = ?1",
            [model.algorithm_slug],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        if algorithm != (algorithm_id.clone(), model.algorithm_name.to_owned()) {
            bail!("algorithm slug reuse disagrees with its stable identity");
        }
        let family_id = stable_id("model-family", model.family_slug);
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
            [model.family_slug],
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
        let instance_id = stable_id("model-instance", model.instance_slug);
        execute_cached(
            &transaction,
            "INSERT INTO ModelInstance (id, modelFamilyId, slug, versionMajor, versionMinor, versionPatch, versionPrerelease) VALUES (?1, ?2, ?3, ?4, ?5, ?6, '')",
            params![
                instance_id,
                family_id,
                model.instance_slug,
                model.version.0,
                model.version.1,
                model.version.2
            ],
        )?;
        bindings.insert(model.artifact.to_owned(), instance_id);
    }
    transaction.commit()?;
    Ok(bindings)
}

fn load_stocks(connection: &mut Connection, corpus_root: &Path) -> Result<HashMap<String, String>> {
    let mut bindings = HashMap::new();
    for stock in STOCKS {
        let relative = format!("inputs/stocks/{}.csv.gz", stock.name);
        let file_path = resolve_confined_regular(corpus_root, &relative)?;
        let manifest_path = resolve_confined_regular(
            corpus_root,
            &format!("inputs/stocks/{}.manifest.json", stock.name),
        )?;
        let (expected_hash, schema_version) = input_provenance(&manifest_path, &file_path)?;
        let transaction = connection.transaction()?;
        let stock_id = stable_id("stock", stock.name);
        execute_cached(
            &transaction,
            "INSERT INTO Stock (id, name, description, sourcePath, sourceSha256, schemaVersion) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                stock_id,
                stock.name,
                stock.description,
                relative,
                expected_hash,
                schema_version
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
        transaction.commit()?;
        bindings.insert(stock.name.to_owned(), stock_id);
    }
    Ok(bindings)
}

fn load_benchmarks(
    connection: &mut Connection,
    corpus_root: &Path,
    stocks: &HashMap<String, String>,
) -> Result<HashMap<String, BenchmarkBinding>> {
    let mut bindings = HashMap::new();
    for benchmark in BENCHMARKS {
        let relative = format!("inputs/benchmarks/{}.json.gz", benchmark.name);
        let file_path = resolve_confined_regular(corpus_root, &relative)?;
        let manifest_path = resolve_confined_regular(
            corpus_root,
            &format!("inputs/benchmarks/{}.manifest.json", benchmark.name),
        )?;
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
                benchmark.stock,
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
        let benchmark_id = stable_id("benchmark", benchmark.name);
        let default_constraints_json = serde_json::to_string(&definition.default_constraints)?;
        let target_constraints_json = serde_json::to_string(&definition.constraints)?;
        execute_cached(
            &transaction,
            "INSERT INTO BenchmarkSet (id, name, description, stockId, hasAcceptableRoutes, sourcePath, sourceSha256, schemaVersion, defaultConstraintsJson, targetConstraintsJson, series, isListed) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1)",
            params![
                benchmark_id,
                benchmark.name,
                definition.description,
                stocks
                    .get(benchmark.stock)
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
                default_constraints: definition.default_constraints,
                target_constraints: definition.constraints,
            },
        );
    }
    Ok(bindings)
}

fn input_provenance(manifest_path: &Path, input_path: &Path) -> Result<(String, String)> {
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
        insert_route_node(transaction, &route_id, &route.target, None, "root")?;
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
    parent_id: Option<&str>,
    path: &str,
) -> Result<()> {
    let molecule_id = ensure_molecule(transaction, &molecule.inchikey, &molecule.smiles)?;
    let node_id = stable_id("route-node", &format!("{route_id}/{path}"));
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
    execute_cached(
        transaction,
        "INSERT INTO RouteNode (id, routeId, moleculeId, smiles, parentId, reactionStepId, template, metadata, isLeaf) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            node_id,
            route_id,
            molecule_id,
            molecule.smiles,
            parent_id,
            reaction_step_id,
            template,
            metadata,
            molecule.product_of.is_none()
        ],
    )?;
    if let Some(reaction) = molecule.product_of.as_deref() {
        for (index, reactant) in reaction.reactants.iter().enumerate() {
            insert_route_node(
                transaction,
                route_id,
                reactant,
                Some(&node_id),
                &format!("{path}/{index}"),
            )?;
        }
    }
    Ok(())
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
