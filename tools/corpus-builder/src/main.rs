use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;
use syntharena_corpus_builder::{BuildOptions, build_corpus};

#[derive(Debug, Parser)]
#[command(about = "Build a staging-only SynthArena SQLite corpus from RetroCast v0.8.3 bundles")]
struct Cli {
    /// Root containing inventory.json, inputs/, and bundles/.
    #[arg(long = "corpus")]
    corpus_root: PathBuf,

    /// New SQLite output path. Existing paths are never overwritten.
    #[arg(long)]
    output: PathBuf,

    /// Import only the first N inventory runs and mark the database local-provisional.
    #[arg(long)]
    limit: Option<usize>,
}

fn main() -> Result<()> {
    // pnpm preserves its `--` forwarding delimiter while Cargo also requires
    // one before binary arguments. Ignore only that delimiter so the documented
    // `pnpm rebuild:corpus -- --corpus ...` form remains ergonomic.
    let cli = Cli::parse_from(
        std::env::args_os().filter(|argument| argument != std::ffi::OsStr::new("--")),
    );
    let report = build_corpus(BuildOptions {
        corpus_root: cli.corpus_root,
        output: cli.output,
        limit: cli.limit,
    })?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
