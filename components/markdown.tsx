import React from "react";

// Lightweight markdown renderer. Supports the subset used in the migration playbook:
// headings (# ## ### ####), paragraphs, blockquotes (>), unordered (-) and
// ordered (1.) lists, fenced code blocks (```lang), inline code (`), bold (**),
// links ([text](url)), horizontal rules (---), and GFM-style tables.

type Inline = string;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenize: code, bold, link. Keep it simple with a single regex pass.
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-4 border-border/60" />);
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push(
        <pre
          key={key++}
          className="my-3 overflow-x-auto rounded-md border border-border/60 bg-muted/50 p-3 text-xs leading-relaxed"
        >
          <code className={`font-mono${lang ? ` language-${lang}` : ""}`}>
            {codeLines.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizes: Record<number, string> = {
        1: "mt-4 mb-2 text-lg font-semibold tracking-tight",
        2: "mt-4 mb-2 text-base font-semibold tracking-tight",
        3: "mt-3 mb-1.5 text-sm font-semibold tracking-tight",
        4: "mt-3 mb-1 text-sm font-medium",
        5: "mt-2 mb-1 text-sm font-medium",
        6: "mt-2 mb-1 text-sm font-medium",
      };
      const className = sizes[level];
      const children = renderInline(text, `h${level}-${key}`);
      if (level === 1) blocks.push(<h1 key={key++} className={className}>{children}</h1>);
      else if (level === 2) blocks.push(<h2 key={key++} className={className}>{children}</h2>);
      else if (level === 3) blocks.push(<h3 key={key++} className={className}>{children}</h3>);
      else blocks.push(<h4 key={key++} className={className}>{children}</h4>);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground"
        >
          {renderInline(quoteLines.join(" "), `bq-${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Table (GFM): header row, separator row of dashes, body rows
    if (line.startsWith("|") && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const parseRow = (row: string): Inline[] =>
        row.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows: Inline[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    className="border-b border-border/60 px-2.5 py-1.5 font-medium text-foreground"
                  >
                    {renderInline(h, `th-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 align-top text-muted-foreground">
                      {renderInline(cell, `td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Lists (unordered or ordered)
    const ulMatch = /^(\s*)-\s+(.*)$/.exec(line);
    const olMatch = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered
          ? /^(\s*)\d+\.\s+(.*)$/.exec(lines[i])
          : /^(\s*)-\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[2]);
        i++;
      }
      if (ordered) {
        blocks.push(
          <ol
            key={key++}
            className="my-2 ml-5 list-decimal space-y-1 text-sm text-muted-foreground"
          >
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it, `ol-${idx}`)}</li>
            ))}
          </ol>,
        );
      } else {
        blocks.push(
          <ul
            key={key++}
            className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground"
          >
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it, `ul-${idx}`)}</li>
            ))}
          </ul>,
        );
      }
      continue;
    }

    // Paragraph — consume consecutive non-special lines
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("|") &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^(\s*)-\s+/.test(lines[i]) &&
      !/^(\s*)\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 text-sm leading-relaxed text-muted-foreground">
        {renderInline(paraLines.join(" "), `p-${key}`)}
      </p>,
    );
  }

  return <div className="prose-custom">{blocks}</div>;
}
