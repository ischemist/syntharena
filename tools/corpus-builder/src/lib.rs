mod bundle;
mod config;
mod contract;
mod identity;
mod loader;
mod stream;
mod wire;

use std::{
    fs::{self, File},
    path::{Path, PathBuf},
    time::Instant,
};

use anyhow::{Context, Result, bail};
use rusqlite::Connection;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tempfile::Builder as TempBuilder;

pub use contract::{RETROCAST_RELEASE_COMMIT, RETROCAST_RELEASE_TAG, RETROCAST_VERSION};

const BASELINE_SQL: &str =
    include_str!("../../../prisma/migrations/20260803000000_initial_solv_n/migration.sql");
const BASELINE_MIGRATION: &str = "20260803000000_initial_solv_n";
const BASELINE_CHECKSUM: &str = "aba1674a7724db90a2203c6b5718c46631914fbd4eda2c5d8d7833341c4c3ee3";

#[derive(Clone, Debug)]
pub struct BuildOptions {
    pub corpus_root: PathBuf,
    pub output: PathBuf,
    pub limit: Option<usize>,
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
    let inventory_path = stream::resolve_confined_regular(&options.corpus_root, "inventory.json")?;
    let (inventory, inventory_sha256) = contract::load_inventory(&inventory_path, options.limit)?;
    let bindings = loader::load_reference_data(&mut connection, &options.corpus_root)?;
    let status = if options.limit.is_some() {
        "local-provisional"
    } else {
        "staging"
    };
    let run_count = options.limit.unwrap_or(inventory.runs.len());
    let mut totals = bundle::ImportTotals::default();
    for (index, entry) in inventory.runs.iter().take(run_count).enumerate() {
        let run = bundle::import_run(&mut connection, &options.corpus_root, entry, &bindings)
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
    connection.execute(
        "INSERT INTO DatabaseMetadata (id, databaseSchemaVersion, artifactSchemaVersion, inventorySchemaVersion, inventorySha256, retrocastVersion, publicationStatus, benchmarkCount, modelCount, expectedRunCount, importedRunCount, evaluationTargetCount, candidateCount, routeCount, failureCount) VALUES ('syntharena', 2, ?1, ?2, ?3, ?4, ?5, 6, 14, 84, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            inventory.evaluation_parameters.schema_version,
            inventory.schema_version,
            inventory_sha256,
            contract::RETROCAST_VERSION,
            status,
            totals.runs as i64,
            totals.targets as i64,
            totals.candidates as i64,
            totals.routes as i64,
            totals.failures as i64,
        ],
    )?;
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
}
