import { program } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { renderToSvg, svgToPng, themeNames, type ThemeName } from "./render.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}

function deriveOutputBase(inputFile: string | undefined, outputOpt: string | undefined): string {
  if (outputOpt) return resolve(outputOpt);
  if (inputFile) {
    const name = basename(inputFile).replace(/\.(mmd|mermaid)$/, "");
    return resolve(name);
  }
  return resolve("diagram");
}

const themeList = themeNames.join(", ");

program
  .name("mermaid-render")
  .description(
    "Render Mermaid diagrams to SVG and PNG using beautiful-mermaid.\n\n" +
    "Input: Pass a .mmd/.mermaid file as an argument, or pipe Mermaid text via stdin.\n" +
    "Output: Writes <base>.svg and/or <base>.png. Base name is derived from --output, " +
    "the input filename, or defaults to 'diagram'.\n\n" +
    "Supported diagram types: flowchart, graph, stateDiagram-v2, sequenceDiagram, classDiagram, " +
    "erDiagram, gantt, pie, xychart-beta, and more.\n\n" +
    "IMPORTANT: Mermaid syntax must use newlines between statements, not semicolons.\n" +
    "  Correct: printf 'graph TD\\n  A-->B' | mermaid-render\n" +
    "  Wrong:   echo 'graph TD; A-->B' | mermaid-render\n\n" +
    "Examples:\n" +
    "  mermaid-render diagram.mmd                          # SVG output to diagram.svg\n" +
    "  mermaid-render diagram.mmd -f png -t tokyo-night    # PNG with theme\n" +
    "  mermaid-render diagram.mmd -f both -o out/result    # SVG + PNG to out/result.*\n" +
    "  printf 'graph TD\\n  A-->B' | mermaid-render -o flow # Stdin to flow.svg\n" +
    "  mermaid-render --list-themes                        # Show all 15 themes\n\n" +
    `Available themes: ${themeList}`
  )
  .argument("[input-file]", ".mmd/.mermaid file path (reads stdin if omitted)")
  .option("-o, --output <path>", "Output base path without extension (default: input filename or 'diagram')")
  .option("-f, --format <fmt>", "Output format: svg, png, or both", "svg")
  .option("-t, --theme <name>", `Color theme (default: zinc-light). Use --list-themes to see all`, "zinc-light")
  .option("--list-themes", "Print available theme names and exit")
  .option("--transparent", "Use transparent background instead of theme background color")
  .option("--scale <factor>", "PNG scale factor for higher resolution output", "2")
  .action(async (inputFile: string | undefined, opts) => {
    if (opts.listThemes) {
      console.log("Available themes:");
      for (const name of themeNames) {
        console.log(`  ${name}`);
      }
      return;
    }

    if (!themeNames.includes(opts.theme)) {
      console.error(`Unknown theme: ${opts.theme}`);
      console.error(`Available: ${themeNames.join(", ")}`);
      process.exit(1);
    }

    let input: string;
    if (inputFile) {
      input = readFileSync(inputFile, "utf-8");
    } else if (!process.stdin.isTTY) {
      input = await readStdin();
    } else {
      console.error("Error: No input file and no stdin input.");
      console.error("Usage: mermaid-render [options] [input-file]");
      process.exit(1);
    }

    input = input.trim();
    if (!input) {
      console.error("Error: Empty input.");
      process.exit(1);
    }

    const format = opts.format as "svg" | "png" | "both";
    if (!["svg", "png", "both"].includes(format)) {
      console.error(`Invalid format: ${format}. Use svg, png, or both.`);
      process.exit(1);
    }

    const outputBase = deriveOutputBase(inputFile, opts.output);
    const scale = parseFloat(opts.scale);

    let svg: string;
    try {
      svg = renderToSvg(input, {
        theme: opts.theme as ThemeName,
        transparent: opts.transparent ?? false,
      });
    } catch (err) {
      console.error(`Render error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }

    if (format === "svg" || format === "both") {
      const path = `${outputBase}.svg`;
      writeFileSync(path, svg);
      console.error(`Wrote ${path}`);
    }

    if (format === "png" || format === "both") {
      const path = `${outputBase}.png`;
      const png = svgToPng(svg, scale, opts.theme as ThemeName, opts.transparent);
      writeFileSync(path, png);
      console.error(`Wrote ${path}`);
    }
  });

program.parse();
