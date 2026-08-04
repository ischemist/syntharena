use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use clap::{Args, Parser, Subcommand};
use syntharena_corpus_builder::{
    AddBenchmarkOptions, AddModelOptions, AddRunOptions, AddStockEnrichmentOptions,
    AddStockOptions, BuildOptions, CoverageMode, add_benchmark, add_model, add_run, add_stock,
    add_stock_enrichment, adopt_workspace, build_corpus, init_workspace, set_coverage,
    set_legacy_url_aliases, set_producer_trust, validate_workspace,
};

#[derive(Debug, Parser)]
#[command(about = "Manage and compile immutable SynthArena corpus workspaces")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Create an empty catalog, generated inventory, and artifact directories.
    Init {
        #[arg(long)]
        corpus: PathBuf,
    },
    /// Attach a catalog to an existing pre-catalog corpus and lock producer evidence.
    Adopt {
        #[arg(long)]
        corpus: PathBuf,
        #[arg(long)]
        catalog: PathBuf,
    },
    /// Register a stock artifact and copy it into the corpus.
    AddStock(AddStock),
    /// Register hash-bound commercial metadata for an existing stock.
    AddStockEnrichment(AddStockEnrichment),
    /// Register a benchmark artifact and copy it into the corpus.
    AddBenchmark(AddBenchmark),
    /// Register an algorithm/model-family version.
    AddModel(AddModel),
    /// Register a verified RetroCast evaluation bundle.
    AddRun(AddRun),
    /// Select explicit registered runs or require a complete benchmark/model cross-product.
    Coverage {
        #[arg(long)]
        corpus: PathBuf,
        #[arg(long)]
        mode: String,
    },
    /// Copy and register a legacy URL alias manifest.
    Aliases {
        #[arg(long)]
        corpus: PathBuf,
        #[arg(long)]
        manifest: PathBuf,
    },
    /// Copy and register the reviewed producer release/executable trust policy.
    TrustPolicy {
        #[arg(long)]
        corpus: PathBuf,
        #[arg(long)]
        policy: PathBuf,
    },
    /// Validate the catalog, inventory, coverage, and confined paths.
    Validate {
        #[arg(long)]
        corpus: PathBuf,
    },
    /// Compile a complete fresh SQLite database without overwriting an existing path.
    Build(Build),
}

#[derive(Debug, Args)]
struct AddStock {
    #[arg(long)]
    corpus: PathBuf,
    #[arg(long)]
    name: String,
    #[arg(long, default_value = "")]
    description: String,
    #[arg(long)]
    artifact: PathBuf,
    #[arg(long)]
    manifest: PathBuf,
}

#[derive(Debug, Args)]
struct AddStockEnrichment {
    #[arg(long)]
    corpus: PathBuf,
    #[arg(long)]
    stock: String,
    #[arg(long)]
    artifact: PathBuf,
    #[arg(long)]
    manifest: PathBuf,
}

#[derive(Debug, Args)]
struct AddBenchmark {
    #[arg(long)]
    corpus: PathBuf,
    #[arg(long)]
    stock: String,
    #[arg(long, default_value = "other")]
    series: String,
    #[arg(long)]
    artifact: PathBuf,
    #[arg(long)]
    manifest: PathBuf,
}

#[derive(Debug, Args)]
struct AddModel {
    #[arg(long)]
    corpus: PathBuf,
    #[arg(long)]
    key: String,
    #[arg(long)]
    algorithm_name: String,
    #[arg(long)]
    algorithm_slug: String,
    #[arg(long)]
    family_name: String,
    #[arg(long)]
    family_slug: String,
    #[arg(long)]
    instance_slug: String,
    #[arg(long)]
    version: String,
}

#[derive(Debug, Args)]
struct AddRun {
    #[arg(long)]
    corpus: PathBuf,
    #[arg(long)]
    benchmark: String,
    #[arg(long)]
    model: String,
    #[arg(long)]
    bundle: PathBuf,
    /// Exact manifest source path when the raw planner result cannot be inferred.
    #[arg(long)]
    raw_path: Option<String>,
    /// Exact manifest source path when execution statistics cannot be inferred.
    #[arg(long)]
    execution_stats_path: Option<String>,
}

#[derive(Debug, Args)]
struct Build {
    #[arg(long)]
    corpus: PathBuf,
    #[arg(long)]
    output: PathBuf,
    /// Import only the first N runs and force local-provisional status.
    #[arg(long)]
    limit: Option<usize>,
    /// Prior published database whose public identities must remain scientifically unchanged.
    #[arg(long)]
    identity_baseline: Option<PathBuf>,
}

fn main() -> Result<()> {
    let cli = Cli::parse_from(
        std::env::args_os().filter(|argument| argument != std::ffi::OsStr::new("--")),
    );
    match cli.command {
        Command::Init { corpus } => init_workspace(&corpus),
        Command::Adopt { corpus, catalog } => adopt_workspace(&corpus, &catalog),
        Command::AddStock(args) => add_stock(AddStockOptions {
            corpus_root: args.corpus,
            name: args.name,
            description: args.description,
            artifact: args.artifact,
            manifest: args.manifest,
        }),
        Command::AddStockEnrichment(args) => add_stock_enrichment(AddStockEnrichmentOptions {
            corpus_root: args.corpus,
            stock: args.stock,
            artifact: args.artifact,
            manifest: args.manifest,
        }),
        Command::AddBenchmark(args) => add_benchmark(AddBenchmarkOptions {
            corpus_root: args.corpus,
            stock: args.stock,
            series: args.series,
            artifact: args.artifact,
            manifest: args.manifest,
        }),
        Command::AddModel(args) => add_model(AddModelOptions {
            corpus_root: args.corpus,
            key: args.key,
            algorithm_name: args.algorithm_name,
            algorithm_slug: args.algorithm_slug,
            family_name: args.family_name,
            family_slug: args.family_slug,
            instance_slug: args.instance_slug,
            version: parse_version(&args.version)?,
        }),
        Command::AddRun(args) => add_run(AddRunOptions {
            corpus_root: args.corpus,
            benchmark: args.benchmark,
            model: args.model,
            bundle: args.bundle,
            raw_path: args.raw_path,
            execution_stats_path: args.execution_stats_path,
        }),
        Command::Coverage { corpus, mode } => set_coverage(&corpus, parse_coverage(&mode)?),
        Command::Aliases { corpus, manifest } => set_legacy_url_aliases(&corpus, &manifest),
        Command::TrustPolicy { corpus, policy } => set_producer_trust(&corpus, &policy),
        Command::Validate { corpus } => validate_workspace(&corpus),
        Command::Build(args) => {
            let report = build_corpus(BuildOptions {
                corpus_root: args.corpus,
                output: args.output,
                limit: args.limit,
                identity_baseline: args.identity_baseline,
            })?;
            println!("{}", serde_json::to_string_pretty(&report)?);
            Ok(())
        }
    }
}

fn parse_coverage(value: &str) -> Result<CoverageMode> {
    match value {
        "explicit" => Ok(CoverageMode::Explicit),
        "cross-product" => Ok(CoverageMode::CrossProduct),
        _ => bail!("--mode must be explicit or cross-product"),
    }
}

fn parse_version(value: &str) -> Result<syntharena_corpus_builder::ModelVersion> {
    let (core, prerelease) = value.split_once('-').unwrap_or((value, ""));
    let parts: Vec<_> = core.split('.').collect();
    if parts.len() != 3 {
        bail!("--version must be semantic major.minor.patch[-prerelease]");
    }
    Ok(syntharena_corpus_builder::ModelVersion {
        major: parts[0].parse().context("invalid version major")?,
        minor: parts[1].parse().context("invalid version minor")?,
        patch: parts[2].parse().context("invalid version patch")?,
        prerelease: prerelease.to_owned(),
    })
}
