import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import { Resvg } from "@resvg/resvg-js";

export type ThemeName = keyof typeof THEMES;

export const themeNames = Object.keys(THEMES) as ThemeName[];

export interface RenderConfig {
  theme?: ThemeName;
  transparent?: boolean;
}

export function renderToSvg(text: string, config: RenderConfig = {}): string {
  const themeColors = config.theme ? THEMES[config.theme] : THEMES["zinc-light"];
  return renderMermaidSVG(text, {
    ...themeColors,
    transparent: config.transparent ?? false,
  });
}

// Mix percentages from beautiful-mermaid's MIX constants
const MIX = {
  textSec: 60,
  textMuted: 40,
  textFaint: 25,
  line: 50,
  arrow: 85,
  nodeFill: 3,
  nodeStroke: 20,
  groupHeader: 5,
  innerStroke: 12,
  keyBadge: 10,
};

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixColors(fg: string, bg: string, fgPercent: number): string {
  const [fr, fg_, fb] = parseHex(fg);
  const [br, bg_, bb] = parseHex(bg);
  const p = fgPercent / 100;
  return toHex(
    fr * p + br * (1 - p),
    fg_ * p + bg_ * (1 - p),
    fb * p + bb * (1 - p),
  );
}

interface ThemeColors {
  bg: string;
  fg: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
}

function resolveThemeVars(theme: ThemeColors, transparent: boolean): Map<string, string> {
  const { bg, fg } = theme;
  const vars = new Map<string, string>();

  // Root CSS custom properties
  vars.set("var(--bg)", transparent ? "transparent" : bg);
  vars.set("var(--fg)", fg);

  // Derived variables: var(--override, color-mix fallback)
  vars.set("var(--_text)", fg);
  vars.set("var(--_text-sec)", theme.muted ?? mixColors(fg, bg, MIX.textSec));
  vars.set("var(--_text-muted)", theme.muted ?? mixColors(fg, bg, MIX.textMuted));
  vars.set("var(--_text-faint)", mixColors(fg, bg, MIX.textFaint));
  vars.set("var(--_line)", theme.line ?? mixColors(fg, bg, MIX.line));
  vars.set("var(--_arrow)", theme.accent ?? mixColors(fg, bg, MIX.arrow));
  vars.set("var(--_node-fill)", theme.surface ?? mixColors(fg, bg, MIX.nodeFill));
  vars.set("var(--_node-stroke)", theme.border ?? mixColors(fg, bg, MIX.nodeStroke));
  vars.set("var(--_group-fill)", transparent ? "transparent" : bg);
  vars.set("var(--_group-hdr)", mixColors(fg, bg, MIX.groupHeader));
  vars.set("var(--_inner-stroke)", mixColors(fg, bg, MIX.innerStroke));
  vars.set("var(--_key-badge)", mixColors(fg, bg, MIX.keyBadge));

  return vars;
}

function inlineSvgForRasterization(svg: string, theme: ThemeColors, transparent: boolean): string {
  const vars = resolveThemeVars(theme, transparent);

  let result = svg;

  // Strip the <style> block entirely (fonts + CSS vars)
  result = result.replace(/<style>[\s\S]*?<\/style>/, "");

  // Strip the inline style on the root <svg> that sets CSS vars
  result = result.replace(
    /(<svg[^>]*)\s+style="[^"]*"/,
    "$1",
  );

  // Replace all var(--*) references with resolved hex values
  // Sort by length descending so longer var names match first
  const sortedVars = [...vars.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [varRef, color] of sortedVars) {
    result = result.replaceAll(varRef, color);
  }

  // Set background as a rect if not transparent
  if (!transparent) {
    // Insert a background rect right after <defs>...</defs> or after the opening <svg> tag
    const bgRect = `<rect width="100%" height="100%" fill="${theme.bg}" />`;
    if (result.includes("</defs>")) {
      result = result.replace("</defs>", `</defs>\n${bgRect}`);
    } else {
      result = result.replace(/>/, `>\n${bgRect}`);
    }
  }

  // Add font-family directly to text elements since <style> was removed
  result = result.replace(
    /(<text\b)(?![^>]*font-family)/g,
    '$1 font-family="Inter, system-ui, sans-serif"',
  );

  return result;
}

export function svgToPng(svg: string, scale: number = 2, theme?: ThemeName, transparent?: boolean): Buffer {
  const themeColors = theme ? THEMES[theme] : THEMES["zinc-light"];
  const inlined = inlineSvgForRasterization(svg, themeColors as ThemeColors, transparent ?? false);

  const resvg = new Resvg(inlined, {
    fitTo: { mode: "zoom", value: scale },
    font: {
      loadSystemFonts: true,
    },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}
