mod aliases;
mod bundle;
mod config;
mod contract;
mod identity;
mod loader;
mod stock_enrichment;
mod stream;
mod trust;
mod wire;
mod workspace;

use std::{
    collections::BTreeMap,
    fs::{self, File},
    path::{Path, PathBuf},
    time::Instant,
};

use anyhow::{Context, Result, bail};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tempfile::Builder as TempBuilder;

pub use aliases::{DeriveLegacyUrlAliasesOptions, derive_legacy_url_aliases};
pub use config::{CoverageMode, ModelVersion};
pub use contract::{RETROCAST_RELEASE_COMMIT, RETROCAST_RELEASE_TAG, RETROCAST_VERSION};
pub use workspace::{
    AddBenchmarkOptions, AddModelOptions, AddRunOptions, AddStockEnrichmentOptions,
    AddStockOptions, add_benchmark, add_model, add_run, add_stock, add_stock_enrichment,
    adopt_workspace, init_workspace, set_coverage, set_legacy_url_aliases, set_producer_trust,
    validate_workspace,
};

const BASELINE_SQL: &str =
    include_str!("../../../prisma/migrations/20260803000000_initial_solv_n/migration.sql");
const BASELINE_MIGRATION: &str = "20260803000000_initial_solv_n";
const BASELINE_CHECKSUM: &str = "8831c6dab4dd0414e44453328aac9b9cb6f68171d0d2b081162eca4bd645bd36";

#[derive(Clone, Debug)]
pub struct BuildOptions {
    pub corpus_root: PathBuf,
    pub output: PathBuf,
    pub limit: Option<usize>,
    pub identity_baseline: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize)]
pub struct BuildReport {
    pub database_schema_version: u8,
    pub publication_status: String,
    pub elapsed_seconds: f64,
    pub output_bytes: u64,
    pub peak_rss_bytes: Option<u64>,
    pub imported_runs: usize,
}

pub fn build_corpus(options: BuildOptions) -> Result<BuildReport> {
    if options.limit.is_some() && options.identity_baseline.is_some() {
        bail!("--identity-baseline requires a complete build without --limit");
    }
    let started = Instant::now();
    let output = absolute_path(&options.output)?;
    if output.exists() {
        bail!("output already exists: {}", output.display());
    }
    let parent = output
        .parent()
        .context("output path must have a parent directory")?;
    fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    let temporary = TempBuilder::new()
        .prefix(".syntharena-corpus-")
        .suffix(".db.tmp")
        .tempfile_in(parent)
        .with_context(|| format!("create staging database beside {}", output.display()))?;
    let (_placeholder, temporary_path) = temporary.keep()?;

    let result = build_staging_database(&options, &temporary_path).and_then(|staging| {
        let output_bytes = fs::metadata(&temporary_path)?.len();
        promote_noclobber(&temporary_path, &output)?;
        Ok(BuildReport {
            database_schema_version: 2,
            publication_status: staging.publication_status,
            elapsed_seconds: started.elapsed().as_secs_f64(),
            output_bytes,
            peak_rss_bytes: peak_rss_bytes(),
            imported_runs: staging.imported_runs,
        })
    });

    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

struct StagingReport {
    publication_status: String,
    imported_runs: usize,
}

fn build_staging_database(options: &BuildOptions, path: &Path) -> Result<StagingReport> {
    let mut connection = Connection::open(path)?;
    connection.set_prepared_statement_cache_capacity(64);
    connection.execute_batch(
        "PRAGMA foreign_keys=ON; PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-131072;",
    )?;
    connection
        .execute_batch(BASELINE_SQL)
        .context("apply SynthArena baseline migration")?;
    record_baseline_migration(&connection)?;
    let catalog_path = stream::resolve_confined_regular(&options.corpus_root, "catalog.json")?;
    let (catalog, catalog_sha256) = config::load_catalog(&catalog_path)?;
    let inventory_path = stream::resolve_confined_regular(&options.corpus_root, "inventory.json")?;
    let (inventory, inventory_sha256) =
        contract::load_inventory(&inventory_path, options.limit, &catalog)?;
    let trust_policy = trust::load_workspace_policy(
        &options.corpus_root,
        catalog
            .producer_trust
            .as_ref()
            .context("corpus build requires a reviewed producer trust policy")?,
    )?;
    let bindings = loader::load_reference_data(&mut connection, &options.corpus_root, &catalog)?;
    let status = if options.limit.is_some() {
        "local-provisional"
    } else {
        "staging"
    };
    let run_count = options.limit.unwrap_or(inventory.runs.len());
    let mut totals = bundle::ImportTotals::default();
    for (index, entry) in inventory.runs.iter().take(run_count).enumerate() {
        let run = bundle::import_run(
            &mut connection,
            &options.corpus_root,
            entry,
            &bindings,
            &trust_policy,
        )
        .with_context(|| format!("import run {} ({}/{run_count})", entry.run_id, index + 1))?;
        totals.runs += run.runs;
        totals.targets += run.targets;
        totals.candidates += run.candidates;
        totals.routes += run.routes;
        totals.failures += run.failures;
        eprintln!(
            "[{}/{}] {}: {} targets, {} candidates",
            index + 1,
            run_count,
            entry.run_id,
            run.targets,
            run.candidates
        );
    }
    if options.limit.is_none() {
        loader::load_legacy_url_aliases(&mut connection, &options.corpus_root, &catalog)?;
    }
    let identity_baseline_sha256 = options
        .identity_baseline
        .as_deref()
        .map(stream::sha256_file)
        .transpose()?;
    if let Some(baseline) = options.identity_baseline.as_deref() {
        assert_identity_continuity(&connection, baseline)?;
    }
    connection.execute(
        "INSERT INTO DatabaseMetadata (id, databaseSchemaVersion, artifactSchemaVersion, inventorySchemaVersion, inventorySha256, catalogSha256, legacyUrlAliasesSha256, identityBaselineSha256, producerTrustPolicySha256, retrocastVersion, publicationStatus, benchmarkCount, modelCount, expectedRunCount, importedRunCount, evaluationTargetCount, candidateCount, routeCount, failureCount) VALUES ('syntharena', 2, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        rusqlite::params![
            inventory.evaluation_parameters.schema_version,
            inventory.schema_version,
            inventory_sha256,
            catalog_sha256,
            catalog
                .legacy_url_aliases
                .as_ref()
                .map(|value| value.artifact_sha256.as_str()),
            identity_baseline_sha256,
            catalog
                .producer_trust
                .as_ref()
                .expect("trust policy presence checked")
                .policy_sha256,
            contract::RETROCAST_VERSION,
            status,
            catalog.benchmarks.len() as i64,
            catalog.models.len() as i64,
            catalog.expected_run_count(inventory.runs.len()) as i64,
            totals.runs as i64,
            totals.targets as i64,
            totals.candidates as i64,
            totals.routes as i64,
            totals.failures as i64,
        ],
    )?;
    assert_portable_text_values(&connection)?;
    assert_database_integrity(&connection)?;
    connection.execute_batch(
        "PRAGMA optimize; PRAGMA temp_store=FILE; PRAGMA cache_size=-32768; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;",
    )?;
    assert_database_integrity(&connection)?;
    connection.close().map_err(|(_, error)| error)?;
    Ok(StagingReport {
        publication_status: status.to_owned(),
        imported_runs: totals.runs,
    })
}

fn assert_identity_continuity(candidate: &Connection, baseline_path: &Path) -> Result<()> {
    let baseline = Connection::open_with_flags(
        baseline_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open identity baseline {}", baseline_path.display()))?;
    let schema_version: i64 = baseline
        .query_row(
            "SELECT databaseSchemaVersion FROM DatabaseMetadata WHERE id = 'syntharena'",
            [],
            |row| row.get(0),
        )
        .context("identity baseline is not a SynthArena corpus database")?;
    if schema_version != 2 {
        bail!("identity baseline must use database schema version 2");
    }
    compare_identity_rows(
        "stock",
        stock_identity_rows(&baseline)?,
        stock_identity_rows(candidate)?,
    )?;
    compare_identity_rows(
        "benchmark",
        benchmark_identity_rows(&baseline)?,
        benchmark_identity_rows(candidate)?,
    )?;
    compare_identity_rows(
        "model instance",
        model_identity_rows(&baseline)?,
        model_identity_rows(candidate)?,
    )?;
    compare_identity_rows(
        "prediction run",
        run_identity_rows(&baseline)?,
        run_identity_rows(candidate)?,
    )?;
    compare_run_cost_rows(run_cost_rows(&baseline)?, run_cost_rows(candidate)?)
}

fn stock_identity_rows(connection: &Connection) -> Result<BTreeMap<String, String>> {
    collect_identity_rows(
        connection,
        "SELECT name, COALESCE(sourceSha256, ''), COALESCE(schemaVersion, ''), COALESCE(enrichmentSha256, ''), COALESCE(enrichmentSchemaVersion, ''), COALESCE(enrichmentManifestSha256, ''), COALESCE(enrichmentSourceDatabaseSha256, '') FROM Stock ORDER BY name",
        7,
    )
}

fn benchmark_identity_rows(connection: &Connection) -> Result<BTreeMap<String, String>> {
    collect_identity_rows(
        connection,
        "SELECT slug, id, COALESCE(sourceSha256, ''), COALESCE(schemaVersion, '') FROM BenchmarkSet ORDER BY slug",
        4,
    )
}

fn model_identity_rows(connection: &Connection) -> Result<BTreeMap<String, String>> {
    collect_identity_rows(
        connection,
        "SELECT mi.slug, a.slug, a.name, f.slug, f.name, CAST(mi.versionMajor AS TEXT), CAST(mi.versionMinor AS TEXT), CAST(mi.versionPatch AS TEXT), mi.versionPrerelease FROM ModelInstance mi JOIN ModelFamily f ON f.id = mi.modelFamilyId JOIN Algorithm a ON a.id = f.algorithmId ORDER BY mi.slug",
        9,
    )
}

fn run_identity_rows(connection: &Connection) -> Result<BTreeMap<String, String>> {
    let mut statement = connection.prepare(
        "SELECT b.slug || '/' || mi.slug, re.manifestSha256 FROM RunEvaluation re JOIN PredictionRun pr ON pr.id = re.predictionRunId JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId JOIN ModelInstance mi ON mi.id = pr.modelInstanceId ORDER BY b.slug, mi.slug",
    )?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get(1)?)))?;
    let mut output = BTreeMap::new();
    for row in rows {
        let (key, value) = row?;
        if output.insert(key.clone(), value).is_some() {
            bail!("identity database has duplicate prediction-run key {key}");
        }
    }
    Ok(output)
}

type RunCost = (Option<f64>, Option<f64>);

fn run_cost_rows(connection: &Connection) -> Result<BTreeMap<String, RunCost>> {
    let mut statement = connection.prepare(
        "SELECT b.slug || '/' || mi.slug, pr.hourlyCost, pr.totalCost FROM PredictionRun pr JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId JOIN ModelInstance mi ON mi.id = pr.modelInstanceId ORDER BY b.slug, mi.slug",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            (row.get::<_, Option<f64>>(1)?, row.get::<_, Option<f64>>(2)?),
        ))
    })?;
    let mut output = BTreeMap::new();
    for row in rows {
        let (key, value) = row?;
        if output.insert(key.clone(), value).is_some() {
            bail!("identity database has duplicate prediction-run cost key {key}");
        }
    }
    Ok(output)
}

fn compare_run_cost_rows(
    baseline: BTreeMap<String, RunCost>,
    candidate: BTreeMap<String, RunCost>,
) -> Result<()> {
    for (key, (prior_hourly, prior_total)) in baseline {
        let (current_hourly, current_total) = candidate
            .get(&key)
            .with_context(|| format!("identity baseline prediction-run cost disappeared: {key}"))?;
        for (label, prior, current) in [
            ("hourlyCost", prior_hourly, *current_hourly),
            ("totalCost", prior_total, *current_total),
        ] {
            if prior.is_some() && current != prior {
                bail!("identity baseline prediction-run {label} changed or disappeared: {key}");
            }
        }
    }
    Ok(())
}

fn collect_identity_rows(
    connection: &Connection,
    sql: &str,
    columns: usize,
) -> Result<BTreeMap<String, String>> {
    let mut statement = connection.prepare(sql)?;
    let rows = statement.query_map([], |row| {
        let key: String = row.get(0)?;
        let values = (1..columns)
            .map(|index| row.get::<_, String>(index))
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok((
            key,
            serde_json::to_string(&values).expect("identity values serialize"),
        ))
    })?;
    let mut output = BTreeMap::new();
    for row in rows {
        let (key, value) = row?;
        if output.insert(key.clone(), value).is_some() {
            bail!("identity database has duplicate key {key}");
        }
    }
    Ok(output)
}

fn compare_identity_rows(
    label: &str,
    baseline: BTreeMap<String, String>,
    candidate: BTreeMap<String, String>,
) -> Result<()> {
    for (key, prior) in baseline {
        let current = candidate
            .get(&key)
            .with_context(|| format!("identity baseline {label} disappeared: {key}"))?;
        if current != &prior {
            bail!("identity baseline {label} changed scientific content: {key}");
        }
    }
    Ok(())
}

fn record_baseline_migration(connection: &Connection) -> Result<()> {
    let actual_checksum = sha256_bytes(BASELINE_SQL.as_bytes());
    if actual_checksum != BASELINE_CHECKSUM {
        bail!(
            "baseline migration checksum changed: expected {BASELINE_CHECKSUM}, got {actual_checksum}"
        );
    }
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS \"_prisma_migrations\" (
            \"id\" TEXT PRIMARY KEY NOT NULL,
            \"checksum\" TEXT NOT NULL,
            \"finished_at\" DATETIME,
            \"migration_name\" TEXT NOT NULL,
            \"logs\" TEXT,
            \"rolled_back_at\" DATETIME,
            \"started_at\" DATETIME NOT NULL DEFAULT current_timestamp,
            \"applied_steps_count\" INTEGER UNSIGNED NOT NULL DEFAULT 0
        );",
    )?;
    let timestamp = chrono::Utc::now().timestamp_millis();
    connection.execute(
        "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?1, ?2, ?3, ?4, ?3, 1)",
        rusqlite::params![
            loader::stable_id("prisma-migration", BASELINE_MIGRATION),
            BASELINE_CHECKSUM,
            timestamp,
            BASELINE_MIGRATION,
        ],
    )?;
    Ok(())
}

fn assert_database_integrity(connection: &Connection) -> Result<()> {
    let integrity: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        bail!("SQLite integrity_check failed: {integrity}");
    }
    let foreign_key_errors: i64 =
        connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get(0)
        })?;
    if foreign_key_errors != 0 {
        bail!("SQLite foreign_key_check found {foreign_key_errors} violations");
    }
    Ok(())
}

fn assert_portable_text_values(connection: &Connection) -> Result<()> {
    fn quote_identifier(value: &str) -> String {
        format!("\"{}\"", value.replace('"', "\"\""))
    }

    let mut tables = connection.prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )?;
    let table_names = tables
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(tables);
    for table in table_names {
        let quoted_table = quote_identifier(&table);
        let mut columns = connection.prepare(&format!("PRAGMA table_info({quoted_table})"))?;
        let text_columns = columns
            .query_map([], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            })?
            .filter_map(|row| match row {
                Ok((name, kind)) if kind.to_ascii_uppercase().contains("TEXT") => Some(Ok(name)),
                Ok(_) => None,
                Err(error) => Some(Err(error)),
            })
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(columns);
        for column in text_columns {
            let quoted_column = quote_identifier(&column);
            let leaked: bool = connection.query_row(
                &format!(
                    "SELECT EXISTS(SELECT 1 FROM {quoted_table} WHERE instr({quoted_column}, '/Users/') > 0 OR instr({quoted_column}, '/home/') > 0 OR instr({quoted_column}, 'C:\\Users\\') > 0 LIMIT 1)"
                ),
                [],
                |row| row.get(0),
            )?;
            if leaked {
                bail!("database contains an absolute home path in {table}.{column}");
            }
        }
    }
    Ok(())
}

fn promote_noclobber(staging: &Path, output: &Path) -> Result<()> {
    File::open(staging)?.sync_all()?;
    fs::hard_link(staging, output).with_context(|| {
        format!(
            "atomically promote {} to {} without overwriting",
            staging.display(),
            output.display()
        )
    })?;
    if let Err(error) = sync_parent(output) {
        let _ = fs::remove_file(output);
        let _ = sync_parent(output);
        return Err(error).context("sync output directory after no-clobber promotion");
    }
    // The destination is durable after the first parent sync. Cleanup cannot
    // invalidate it, so a staging-unlink failure must not turn a successful
    // no-clobber promotion into an ambiguous reported failure.
    if fs::remove_file(staging).is_ok() {
        let _ = sync_parent(output);
    }
    Ok(())
}

fn sync_parent(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        File::open(path.parent().context("output has no parent")?)?.sync_all()?;
    }
    Ok(())
}

fn absolute_path(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        return Ok(path.to_owned());
    }
    Ok(std::env::current_dir()?.join(path))
}

fn peak_rss_bytes() -> Option<u64> {
    #[cfg(unix)]
    unsafe {
        let mut usage = std::mem::zeroed::<libc::rusage>();
        if libc::getrusage(libc::RUSAGE_SELF, &mut usage) != 0 {
            return None;
        }
        #[cfg(target_os = "macos")]
        return Some(usage.ru_maxrss as u64);
        #[cfg(not(target_os = "macos"))]
        return Some((usage.ru_maxrss as u64).saturating_mul(1024));
    }
    #[cfg(not(unix))]
    None
}

pub(crate) fn sha256_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn costs(rows: &[(&str, Option<f64>, Option<f64>)]) -> BTreeMap<String, RunCost> {
        rows.iter()
            .map(|(key, hourly, total)| (key.to_string(), (*hourly, *total)))
            .collect()
    }

    #[test]
    fn cost_continuity_allows_filling_pre_cost_baselines() {
        compare_run_cost_rows(
            costs(&[("bench/model", None, None)]),
            costs(&[("bench/model", Some(0.5), Some(1.25))]),
        )
        .unwrap();
    }

    #[test]
    fn cost_continuity_rejects_drift_and_removal() {
        let baseline = costs(&[("bench/model", Some(0.5), Some(1.25))]);
        assert!(
            compare_run_cost_rows(
                baseline.clone(),
                costs(&[("bench/model", Some(0.6), Some(1.25))])
            )
            .is_err()
        );
        assert!(
            compare_run_cost_rows(baseline.clone(), costs(&[("bench/model", Some(0.5), None)]))
                .is_err()
        );
        assert!(compare_run_cost_rows(baseline, BTreeMap::new()).is_err());
    }

    #[test]
    fn baseline_is_the_solv_n_schema() {
        assert!(BASELINE_SQL.contains("CREATE TABLE \"RunEvaluation\""));
        assert!(BASELINE_SQL.contains("CREATE TABLE \"CandidateTierResult\""));
        assert!(BASELINE_SQL.contains("CREATE TABLE \"DatabaseMetadata\""));
        assert_eq!(sha256_bytes(BASELINE_SQL.as_bytes()), BASELINE_CHECKSUM);
    }

    #[test]
    fn baseline_migration_bookkeeping_matches_prisma() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(BASELINE_SQL).unwrap();
        record_baseline_migration(&connection).unwrap();
        let row: (String, String, i64) = connection
            .query_row(
                "SELECT checksum, migration_name, applied_steps_count FROM _prisma_migrations",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(
            row,
            (
                BASELINE_CHECKSUM.to_owned(),
                BASELINE_MIGRATION.to_owned(),
                1
            )
        );
    }

    #[test]
    fn malformed_route_rolls_back_its_transaction() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(BASELINE_SQL).unwrap();
        {
            let transaction = connection.transaction().unwrap();
            let good: wire::Route = serde_json::from_value(serde_json::json!({
                "target": {"smiles": "C", "inchikey": "GOOD", "annotations": {}},
                "annotations": {}, "schema_version": "2"
            }))
            .unwrap();
            loader::ensure_route(&transaction, &good).unwrap();
            let mut malformed = good;
            malformed.schema_version = "1".to_owned();
            assert!(loader::ensure_route(&transaction, &malformed).is_err());
        }
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM Route", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn route_node_trigger_rejects_cross_route_parenting() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        connection.execute_batch(BASELINE_SQL).unwrap();
        connection
            .execute_batch(
                "INSERT INTO Route (id, signature, contentHash, length, isConvergent)
             VALUES ('r1', 's1', 'h1', 1, 0), ('r2', 's2', 'h2', 1, 0);
             INSERT INTO Molecule (id, inchikey, smiles) VALUES ('m', 'IK', 'C'), ('m2', 'IK2', 'N');
             INSERT INTO ReactionStep (id, reactionHash) VALUES ('reaction', 'reaction-hash');
             INSERT INTO RouteNodePayload (contentHash, moleculeId, smiles, reactionStepId) VALUES ('p', 'm', 'C', 'reaction');
             INSERT INTO RouteNode (routeId, moleculeId, payloadId, parentId, isLeaf)
             VALUES ('r1', 'm', 1, NULL, 0);",
            )
            .unwrap();
        assert!(connection.execute(
            "INSERT INTO RouteNode (routeId, moleculeId, payloadId, parentId, isLeaf) VALUES ('r2', 'm', 1, 1, 1)",
            [],
        ).is_err());
        connection
            .execute(
                "INSERT INTO RouteNode (routeId, moleculeId, payloadId, parentId, isLeaf) VALUES ('r1', 'm', 1, 1, 1)",
                [],
            )
            .unwrap();
        assert!(
            connection
                .execute("UPDATE RouteNode SET routeId = 'r2' WHERE id = 2", [])
                .is_err()
        );
        assert!(
            connection
                .execute(
                    "INSERT INTO RouteNode (routeId, moleculeId, payloadId, parentId, isLeaf) VALUES ('r1', 'm2', 1, NULL, 1)",
                    [],
                )
                .is_err()
        );
        assert!(
            connection
                .execute("DELETE FROM ReactionStep WHERE id = 'reaction'", [])
                .is_err()
        );
        connection
            .execute("DELETE FROM Route WHERE id = 'r1'", [])
            .unwrap();
        let remaining: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM RouteNode WHERE routeId = 'r1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn no_clobber_promotion_preserves_existing_output() {
        let directory = tempfile::tempdir().unwrap();
        let staging = directory.path().join("staging");
        let output = directory.path().join("output");
        fs::write(&staging, b"new").unwrap();
        fs::write(&output, b"existing").unwrap();
        assert!(promote_noclobber(&staging, &output).is_err());
        assert_eq!(fs::read(&output).unwrap(), b"existing");
        assert_eq!(fs::read(&staging).unwrap(), b"new");
    }

    #[test]
    fn portable_text_audit_rejects_absolute_home_paths() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("CREATE TABLE Evidence (value TEXT); INSERT INTO Evidence VALUES ('/Users/example/input.json');")
            .unwrap();
        assert!(assert_portable_text_values(&connection).is_err());
        connection
            .execute("UPDATE Evidence SET value = 'external/input.json'", [])
            .unwrap();
        assert_portable_text_values(&connection).unwrap();
    }
}
