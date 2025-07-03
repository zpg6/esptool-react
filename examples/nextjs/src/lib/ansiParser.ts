interface ANSIStyle {
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    dim?: boolean;
}

interface ParsedSegment {
    text: string;
    style: ANSIStyle;
}

const ANSI_COLORS = {
    // Standard colors - darker for light background
    30: "#1f2937", // black -> dark gray
    31: "#dc2626", // red
    32: "#059669", // green -> darker green
    33: "#d97706", // yellow -> amber
    34: "#2563eb", // blue
    35: "#7c3aed", // magenta -> purple
    36: "#0891b2", // cyan -> darker cyan
    37: "#374151", // white -> dark gray

    // Bright colors - still visible on light background
    90: "#6b7280", // bright black (gray)
    91: "#ef4444", // bright red
    92: "#10b981", // bright green
    93: "#f59e0b", // bright yellow
    94: "#3b82f6", // bright blue
    95: "#8b5cf6", // bright magenta
    96: "#06b6d4", // bright cyan
    97: "#111827", // bright white -> very dark
};

const ANSI_BG_COLORS = {
    40: "#1f2937", // black
    41: "#fecaca", // red -> light red
    42: "#d1fae5", // green -> light green
    43: "#fef3c7", // yellow -> light yellow
    44: "#dbeafe", // blue -> light blue
    45: "#e9d5ff", // magenta -> light purple
    46: "#cffafe", // cyan -> light cyan
    47: "#f9fafb", // white -> very light gray

    // Bright background colors
    100: "#e5e7eb", // bright black -> light gray
    101: "#fee2e2", // bright red -> very light red
    102: "#ecfdf5", // bright green -> very light green
    103: "#fffbeb", // bright yellow -> very light yellow
    104: "#eff6ff", // bright blue -> very light blue
    105: "#f3e8ff", // bright magenta -> very light purple
    106: "#f0fdfa", // bright cyan -> very light cyan
    107: "#ffffff", // bright white
};

export function parseANSI(text: string): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    let currentStyle: ANSIStyle = {};

    // Split by ANSI escape sequences
    const parts = text.split(/\x1b\[([0-9;]*)m/);

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // This is text content
            if (parts[i]) {
                segments.push({
                    text: parts[i],
                    style: { ...currentStyle },
                });
            }
        } else {
            // This is an ANSI code
            const codes = parts[i].split(";").map(code => parseInt(code, 10));

            for (const code of codes) {
                if (isNaN(code)) continue;

                switch (code) {
                    case 0: // Reset
                        currentStyle = {};
                        break;
                    case 1: // Bold
                        currentStyle.bold = true;
                        break;
                    case 2: // Dim
                        currentStyle.dim = true;
                        break;
                    case 3: // Italic
                        currentStyle.italic = true;
                        break;
                    case 4: // Underline
                        currentStyle.underline = true;
                        break;
                    case 22: // Normal intensity
                        currentStyle.bold = false;
                        currentStyle.dim = false;
                        break;
                    case 23: // Not italic
                        currentStyle.italic = false;
                        break;
                    case 24: // Not underlined
                        currentStyle.underline = false;
                        break;
                    default:
                        // Color codes
                        if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
                            currentStyle.color = ANSI_COLORS[code as keyof typeof ANSI_COLORS];
                        } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
                            currentStyle.backgroundColor = ANSI_BG_COLORS[code as keyof typeof ANSI_BG_COLORS];
                        }
                        break;
                }
            }
        }
    }

    return segments;
}

export function stylesToCSS(style: ANSIStyle): React.CSSProperties {
    const css: React.CSSProperties = {};

    if (style.color) css.color = style.color;
    if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
    if (style.bold) css.fontWeight = "bold";
    if (style.italic) css.fontStyle = "italic";
    if (style.underline) css.textDecoration = "underline";
    if (style.dim) css.opacity = 0.7;

    return css;
}
