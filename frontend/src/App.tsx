import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUp,
  Check,
  Download,
  FileCode2,
  RotateCcw,
  Upload,
} from 'lucide-react';
import portraitBanner from '@assets/her02_1792686709663.jpg';

type FileMetadata = {
  filename: string;
  file_size: number;
  elf_class: string;
  endianness: string;
  machine: string;
  type?: string | null;
  symbol_table_present: boolean;
};

type SizeMetric = {
  baseline: number;
  candidate: number;
  delta: number;
  percent_change?: number | null;
};

type Summary = {
  file_size: SizeMetric;
  allocated_section_bytes?: SizeMetric;
  load_segment_file_bytes?: SizeMetric;
  load_segment_memory_bytes?: SizeMetric;
};

type DeltaRow = {
  name: string;
  baseline: number | null;
  candidate: number | null;
  delta: number;
  type?: string | null;
  binding?: string | null;
  section?: string | null;
  baseline_type?: string | null;
  candidate_type?: string | null;
  baseline_flags?: number | null;
  candidate_flags?: number | null;
};

type Analysis = {
  baseline: FileMetadata;
  candidate: FileMetadata;
  summary: Summary;
  sections: DeltaRow[];
  symbols: DeltaRow[];
  largest_symbol_increases?: DeltaRow[];
  largest_symbol_decreases?: DeltaRow[];
  warnings: string[];
};

type Slot = 'baseline' | 'candidate';

const formatBytes = (value: number) => {
  if (!Number.isFinite(value)) return '—';

  const abs = Math.abs(value);

  if (abs < 1000) {
    return `${value.toLocaleString()} B`;
  }

  const units = ['kB', 'MB', 'GB', 'TB'];
  let size = abs / 1000;
  let unit = 0;

  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }

  return `${value < 0 ? '−' : ''}${size.toFixed(size >= 100 ? 1 : 2)} ${units[unit]}`;
};

const signed = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString()}`;

const deltaClass = (value: number) =>
  value > 0 ? 'negative' : value < 0 ? 'positive' : 'neutral';

const asMetric = (value: SizeMetric | undefined) => value ?? null;

const formatNullableBytes = (value: number | null) =>
  value === null ? '—' : formatBytes(value);

const formatNullableRaw = (value: number | null) =>
  value === null ? '—' : value.toLocaleString();

const markdownNullableBytes = (value: number | null) =>
  value === null ? '—' : `${value} B`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isMetadata(value: unknown): value is FileMetadata {
  return (
    isRecord(value) &&
    typeof value.filename === 'string' &&
    typeof value.file_size === 'number' &&
    typeof value.elf_class === 'string' &&
    typeof value.endianness === 'string' &&
    typeof value.machine === 'string' &&
    typeof value.symbol_table_present === 'boolean'
  );
}

function isMetric(value: unknown): value is SizeMetric {
  return (
    isRecord(value) &&
    typeof value.baseline === 'number' &&
    typeof value.candidate === 'number' &&
    typeof value.delta === 'number'
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isDeltaRow(value: unknown): value is DeltaRow {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isNullableNumber(value.baseline) &&
    isNullableNumber(value.candidate) &&
    typeof value.delta === 'number'
  );
}

function parseAnalysis(value: unknown): Analysis | null {
  if (
    !isRecord(value) ||
    !isMetadata(value.baseline) ||
    !isMetadata(value.candidate) ||
    !isRecord(value.summary)
  ) {
    return null;
  }

  const summary = value.summary;

  if (!isMetric(summary.file_size)) {
    return null;
  }

  for (const key of [
    'allocated_section_bytes',
    'load_segment_file_bytes',
    'load_segment_memory_bytes',
  ]) {
    if (summary[key] !== undefined && !isMetric(summary[key])) {
      return null;
    }
  }

  if (
    !Array.isArray(value.sections) ||
    !value.sections.every(isDeltaRow)
  ) {
    return null;
  }

  if (
    !Array.isArray(value.symbols) ||
    !value.symbols.every(isDeltaRow)
  ) {
    return null;
  }

  if (
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === 'string')
  ) {
    return null;
  }

  if (
    value.largest_symbol_increases !== undefined &&
    (!Array.isArray(value.largest_symbol_increases) ||
      !value.largest_symbol_increases.every(isDeltaRow))
  ) {
    return null;
  }

  if (
    value.largest_symbol_decreases !== undefined &&
    (!Array.isArray(value.largest_symbol_decreases) ||
      !value.largest_symbol_decreases.every(isDeltaRow))
  ) {
    return null;
  }

  return {
    baseline: value.baseline,
    candidate: value.candidate,
    summary: summary as unknown as Summary,
    sections: value.sections,
    symbols: value.symbols,
    largest_symbol_increases: value.largest_symbol_increases as
      | DeltaRow[]
      | undefined,
    largest_symbol_decreases: value.largest_symbol_decreases as
      | DeltaRow[]
      | undefined,
    warnings: value.warnings,
  };
}

function HeroArtwork() {
  return (
    <section className="hero-art" aria-labelledby="hero-title">
      <img
        className="hero-image"
        src={portraitBanner}
        alt=""
        aria-hidden="true"
      />
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-copy">
        <h1 id="hero-title" className="serif hero-title">
          ERRATA
        </h1>
        <p className="hero-description">ELF binary size comparison</p>
      </div>
    </section>
  );
}

function ScrollReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      element.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.classList.add('is-visible');
          observer.unobserve(element);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function UploadPanel({
  slot,
  file,
  onSelect,
  disabled,
}: {
  slot: Slot;
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const id = `elf-${slot}`;

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    onSelect(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);

    if (!disabled) {
      onSelect(event.dataTransfer.files?.[0] ?? null);
    }
  };

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="eyebrow">
          {slot === 'baseline' ? '01 / Baseline ELF' : '02 / Candidate ELF'}
        </label>
        <span className="text-[10px] text-[#A4AA9B]">
          {slot === 'baseline' ? 'reference build' : 'build under review'}
        </span>
      </div>

      <input
        ref={inputRef}
        id={id}
        className="sr-only"
        type="file"
        accept=".elf,application/octet-stream"
        onChange={choose}
        disabled={disabled}
        data-testid={`input-${slot}-elf`}
      />

      <button
        type="button"
        className="file-drop flex min-h-[112px] w-full flex-col items-center justify-center border border-dashed border-[#4D594B] px-4 py-4 text-center"
        data-dragging={dragging}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        data-testid={`button-choose-${slot}`}
      >
        {file ? (
          <>
            <FileCode2
              size={18}
              strokeWidth={1.5}
              className="mb-2 text-[#A8C98A]"
            />
            <span className="max-w-full truncate text-sm text-[#E9E5D9]">
              {file.name}
            </span>
            <span className="mt-1 text-[10px] text-[#A4AA9B]">
              {formatBytes(file.size)} · selected
            </span>
          </>
        ) : (
          <>
            <Upload
              size={17}
              strokeWidth={1.5}
              className="mb-2 text-[#8CAFC2]"
            />
            <span className="text-sm">
              {dragging ? 'Drop ELF here' : 'Choose file or drop here'}
            </span>
            <span
              id={`${id}-hint`}
              className="mt-1 text-[10px] text-[#A4AA9B]"
            >
              ELF binary · local upload
            </span>
          </>
        )}
      </button>
    </div>
  );
}

function MetadataTable({ analysis }: { analysis: Analysis }) {
  const rows: [string, string, string][] = [
    [
      'File',
      analysis.baseline.filename,
      analysis.candidate.filename,
    ],
    [
      'Actual file size',
      formatBytes(analysis.baseline.file_size),
      formatBytes(analysis.candidate.file_size),
    ],
    [
      'ELF class',
      analysis.baseline.elf_class,
      analysis.candidate.elf_class,
    ],
    [
      'Endianness',
      analysis.baseline.endianness,
      analysis.candidate.endianness,
    ],
    [
      'Machine',
      analysis.baseline.machine,
      analysis.candidate.machine,
    ],
    [
      'Type',
      analysis.baseline.type || '—',
      analysis.candidate.type || '—',
    ],
    [
      'Symbol table',
      analysis.baseline.symbol_table_present ? 'Present' : 'Absent',
      analysis.candidate.symbol_table_present ? 'Present' : 'Absent',
    ],
  ];

  return (
    <div className="table-wrap">
      <table className="result-table" aria-label="Returned ELF file metadata">
        <thead>
          <tr>
            <th>File metadata</th>
            <th>Baseline</th>
            <th>Candidate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, baseline, candidate]) => (
            <tr key={label}>
              <td className="text-[#A4AA9B]">{label}</td>
              <td className="max-w-[240px] truncate">{baseline}</td>
              <td className="max-w-[240px] truncate">{candidate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricLine({
  label,
  metric,
  unit = 'bytes',
}: {
  label: string;
  metric: SizeMetric | null;
  unit?: string;
}) {
  const display = (value: number) =>
    unit === 'bytes' ? formatBytes(value) : value.toLocaleString();

  return (
    <div className="metric-row">
      <div className="text-sm">{label}</div>
      {metric ? (
        <>
          <div>
            <div className="eyebrow">Baseline</div>
            <div className="mt-1 data-mono">{display(metric.baseline)}</div>
          </div>
          <div>
            <div className="eyebrow">Candidate</div>
            <div className="mt-1 data-mono">{display(metric.candidate)}</div>
          </div>
          <div>
            <div className="eyebrow">Delta</div>
            <div className={`mt-1 data-mono ${deltaClass(metric.delta)}`}>
              {signed(metric.delta)}
              {unit === 'bytes' ? ' B' : ''}
            </div>
          </div>
        </>
      ) : (
        <div className="col-span-3 text-xs text-[#A4AA9B]">
          Not reported by analyzer
        </div>
      )}
    </div>
  );
}

function DeltaTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: DeltaRow[];
  kind: 'section' | 'symbol';
}) {
  const ordered =
    kind === 'symbol'
      ? [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      : rows;

  return (
    <section className="frame">
      <div className="frame-rule flex items-baseline justify-between px-4 py-3">
        <h3 className="text-xs font-medium uppercase tracking-[.1em]">
          {title}
        </h3>
        <span className="text-[10px] text-[#A4AA9B]">
          {rows.length} {kind === 'section' ? 'sections' : 'symbols'}
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="px-4 py-5 text-xs text-[#A4AA9B]">
          No {kind === 'section' ? 'section' : 'symbol'} deltas returned.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="result-table" aria-label={title}>
            <thead>
              <tr>
                <th>{kind === 'section' ? 'Section' : 'Symbol'}</th>
                <th>Baseline</th>
                <th>Candidate</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, index) => (
                <tr key={`${row.name}-${index}`}>
                  <td className="max-w-[250px] truncate">{row.name}</td>
                  <td className="data-mono">
                    {formatNullableBytes(row.baseline)}
                  </td>
                  <td className="data-mono">
                    {formatNullableBytes(row.candidate)}
                  </td>
                  <td className={`data-mono ${deltaClass(row.delta)}`}>
                    {signed(row.delta)} B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function reportMarkdown(analysis: Analysis) {
  const lines = [
    '# errata — ELF size comparison',
    '',
    '## File metadata',
    '',
    '| Attribute | Baseline | Candidate |',
    '| --- | --- | --- |',
    `| Filename | ${analysis.baseline.filename} | ${analysis.candidate.filename} |`,
    `| Actual file size | ${analysis.baseline.file_size} bytes | ${analysis.candidate.file_size} bytes |`,
    `| ELF class | ${analysis.baseline.elf_class} | ${analysis.candidate.elf_class} |`,
    `| Endianness | ${analysis.baseline.endianness} | ${analysis.candidate.endianness} |`,
    `| Machine | ${analysis.baseline.machine} | ${analysis.candidate.machine} |`,
    `| Type | ${analysis.baseline.type ?? 'Not reported'} | ${analysis.candidate.type ?? 'Not reported'} |`,
    `| Symbol table | ${analysis.baseline.symbol_table_present ? 'Present' : 'Absent'} | ${analysis.candidate.symbol_table_present ? 'Present' : 'Absent'} |`,
    '',
    '## Summary',
    '',
    '| Metric | Baseline | Candidate | Delta |',
    '| --- | ---: | ---: | ---: |',
    ...(
      [
        ['File size', analysis.summary.file_size],
        ['Allocated section bytes', analysis.summary.allocated_section_bytes],
        ['Load segment file bytes', analysis.summary.load_segment_file_bytes],
        ['Load segment memory bytes', analysis.summary.load_segment_memory_bytes],
      ] as [string, SizeMetric | undefined][]
    ).map(
      ([label, metric]) =>
        `| ${label} | ${metric ? `${metric.baseline} B` : 'Not reported'} | ${metric ? `${metric.candidate} B` : 'Not reported'} | ${metric ? `${metric.delta > 0 ? '+' : ''}${metric.delta} B` : 'Not reported'} |`,
    ),
    '',
    '## Section deltas',
    '',
    '| Section | Baseline | Candidate | Delta |',
    '| --- | ---: | ---: | ---: |',
    ...(
      analysis.sections.length
        ? analysis.sections.map(
            (row) =>
              `| ${row.name} | ${markdownNullableBytes(row.baseline)} | ${markdownNullableBytes(row.candidate)} | ${row.delta > 0 ? '+' : ''}${row.delta} B |`,
          )
        : ['| No section deltas returned | — | — | — |']
    ),
    '',
    '## Largest symbol increases',
    '',
    '| Symbol | Baseline | Candidate | Delta |',
    '| --- | ---: | ---: | ---: |',
    ...(
      analysis.symbols
        .filter((row) => row.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 10).length
        ? analysis.symbols
            .filter((row) => row.delta > 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 10)
            .map(
              (row) =>
                `| ${row.name} | ${markdownNullableBytes(row.baseline)} | ${markdownNullableBytes(row.candidate)} | +${row.delta} B |`,
            )
        : ['| No increases returned | — | — | — |']
    ),
    '',
    '## Largest symbol decreases',
    '',
    '| Symbol | Baseline | Candidate | Delta |',
    '| --- | ---: | ---: | ---: |',
    ...(
      analysis.symbols
        .filter((row) => row.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 10).length
        ? analysis.symbols
            .filter((row) => row.delta < 0)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, 10)
            .map(
              (row) =>
                `| ${row.name} | ${markdownNullableBytes(row.baseline)} | ${markdownNullableBytes(row.candidate)} | ${row.delta} B |`,
            )
        : ['| No decreases returned | — | — | — |']
    ),
    '',
    '## Warnings',
    '',
    ...(analysis.warnings.length
      ? analysis.warnings.map((warning) => `- ${warning}`)
      : ['- None returned by analyzer.']),
    '',
    '> Limitations: this report reflects only fields returned by the analyzer. Unreported optional metrics are unavailable, not zero; symbol and section data may not explain all file-size changes.',
    '',
  ];

  return lines.join('\n');
}

function downloadReport(analysis: Analysis) {
  const blob = new Blob([reportMarkdown(analysis)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = 'errata-elf-comparison.md';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function App() {
  const [baseline, setBaseline] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggingWindow, setDraggingWindow] = useState(false);

  const reset = () => {
    setBaseline(null);
    setCandidate(null);
    setAnalysis(null);
    setError('');
    setLoading(false);
  };

  const analyze = async () => {
    setError('');

    if (!baseline || !candidate) {
      setError(
        'Choose both a baseline ELF and a candidate ELF before analyzing.',
      );
      return;
    }

    if (
      baseline === candidate ||
      (baseline.name === candidate.name &&
        baseline.size === candidate.size &&
        baseline.lastModified === candidate.lastModified)
    ) {
      setError('Choose two distinct files to compare.');
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const form = new FormData();
      form.append('baseline', baseline);
      form.append('candidate', candidate);

      const response = await fetch('/api/v1/analyze', {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        let detail = '';

        try {
          const payload: unknown = await response.json();
          if (isRecord(payload) && typeof payload.detail === 'string') {
            detail = payload.detail;
          } else {
            detail = JSON.stringify(payload);
          }
        } catch {
          detail = await response.text();
        }

        throw new Error(
          detail.trim() || `Analyzer returned HTTP ${response.status}.`,
        );
      }

      const payload: unknown = await response.json();
      const result = parseAnalysis(payload);

      if (!result) {
        throw new Error(
          'The analyzer responded, but its payload did not match the expected ELF comparison format.',
        );
      }

      setAnalysis(result);
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? 'Could not reach /api/v1/analyze. Check that the API server is available, then try again.'
          : cause instanceof Error
            ? cause.message
            : 'The analyzer request failed. Check the API connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const stopWindowDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingWindow(false);
  };

  const delta = analysis?.summary.file_size.delta;
  const decrease = typeof delta === 'number' && delta < 0;

  return (
    <div
      className="min-h-[100dvh] bg-[#101311] pb-12"
      onDragOver={(event) => {
        event.preventDefault();
        setDraggingWindow(true);
      }}
      onDragLeave={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setDraggingWindow(false);
        }
      }}
      onDrop={stopWindowDrop}
    >
      <HeroArtwork />

      <div className="app-shell">
        <main className="pt-7">
          <ScrollReveal>
            <section className="frame" aria-labelledby="upload-heading">
              <div className="frame-rule flex items-center justify-between px-4 py-3">
                <h2
                  id="upload-heading"
                  className="text-xs uppercase tracking-[.1em]"
                >
                  Compare two binaries
                </h2>
                <span className="text-[10px] text-[#A4AA9B]">
                  POST /api/v1/analyze
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <UploadPanel
                  slot="baseline"
                  file={baseline}
                  onSelect={(file) => {
                    setBaseline(file);
                    setError('');
                    setAnalysis(null);
                  }}
                  disabled={loading}
                />

                <div
                  className="hidden pb-10 text-[#A4AA9B] md:block"
                  aria-hidden="true"
                >
                  <ArrowLeftRight size={16} strokeWidth={1.4} />
                </div>

                <UploadPanel
                  slot="candidate"
                  file={candidate}
                  onSelect={(file) => {
                    setCandidate(file);
                    setError('');
                    setAnalysis(null);
                  }}
                  disabled={loading}
                />
              </div>

              {draggingWindow && (
                <div
                  aria-live="polite"
                  className="mx-4 mb-3 border border-[#A8C98A] px-3 py-2 text-[11px] text-[#A8C98A]"
                >
                  Drop a file into a selected slot above.
                </div>
              )}

              {error && (
                <div
                  className="mx-4 mb-4 flex items-start gap-2 border border-[#C76D63]/65 bg-[#49372B]/35 p-3 text-xs leading-5 text-[#E9E5D9]"
                  role="alert"
                  data-testid="status-error"
                >
                  <AlertTriangle
                    size={15}
                    className="mt-0.5 shrink-0 text-[#C76D63]"
                  />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-[#4D594B] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[470px] text-[10px] leading-4 text-[#A4AA9B]">
                  Files are sent to the configured analyzer for comparison. No
                  result is shown until the API returns valid data.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="quiet-button inline-flex min-h-10 items-center gap-2 px-3 text-xs"
                    onClick={reset}
                    disabled={loading}
                    data-testid="button-reset"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>

                  <button
                    type="button"
                    className="action-button inline-flex min-h-10 items-center gap-2 px-4 text-xs font-medium"
                    onClick={analyze}
                    disabled={loading}
                    data-testid="button-analyze"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block h-3 w-3 animate-pulse border border-[#101311]" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        Analyze pair <ArrowUp size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {loading && (
            <ScrollReveal className="mt-6">
              <section
                aria-live="polite"
                aria-label="Analysis in progress"
                data-testid="status-loading"
              >
                <div className="mb-3 flex items-center gap-2 text-xs text-[#A8C98A]">
                  <span className="h-2 w-2 animate-pulse bg-[#A8C98A]" />
                  Reading ELF artifacts from analyzer…
                </div>
                <div className="frame space-y-3 p-4">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-24 w-full" />
                </div>
              </section>
            </ScrollReveal>
          )}

          {analysis && (
            <ScrollReveal className="mt-8">
              <section
                className="space-y-4"
                aria-label="Comparison results"
                data-testid="section-results"
              >
                <div className="flex flex-col gap-3 border-b border-[#4D594B] pb-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="eyebrow mb-1">
                      Analysis returned / verified response
                    </p>
                    <h2 className="serif text-3xl">The size ledger</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadReport(analysis)}
                      className="quiet-button inline-flex min-h-9 items-center gap-2 px-3 text-[11px]"
                      data-testid="button-download-report"
                    >
                      <Download size={13} /> Download Markdown
                    </button>

                    <button
                      type="button"
                      onClick={reset}
                      className="quiet-button inline-flex min-h-9 items-center gap-2 px-3 text-[11px]"
                      data-testid="button-new-comparison"
                    >
                      <RotateCcw size={13} /> New pair
                    </button>
                  </div>
                </div>

                <div className="frame">
                  <div className="frame-rule flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[.08em]">
                      <Check size={14} className="text-[#A8C98A]" />
                      File-size delta
                    </div>

                    <span
                      className={`data-mono text-lg ${deltaClass(analysis.summary.file_size.delta)}`}
                    >
                      {signed(analysis.summary.file_size.delta)} B
                      <span className="ml-2 text-[10px] text-[#A4AA9B]">
                        (
                        {decrease
                          ? 'smaller'
                          : analysis.summary.file_size.delta > 0
                            ? 'larger'
                            : 'unchanged'}
                        )
                      </span>
                    </span>
                  </div>

                  <MetricLine
                    label="File size"
                    metric={asMetric(analysis.summary.file_size)}
                  />
                  <MetricLine
                    label="Allocated section bytes"
                    metric={asMetric(analysis.summary.allocated_section_bytes)}
                  />
                  <MetricLine
                    label="Load segment file bytes"
                    metric={asMetric(analysis.summary.load_segment_file_bytes)}
                  />
                  <MetricLine
                    label="Load segment memory bytes"
                    metric={asMetric(analysis.summary.load_segment_memory_bytes)}
                  />

                  <p className="px-4 py-2 text-[10px] text-[#A4AA9B]">
                    Positive delta means the candidate uses more bytes.
                    Optional metrics not returned are unavailable—not zero.
                  </p>
                </div>

                <MetadataTable analysis={analysis} />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <DeltaTable
                    title="Allocated section deltas"
                    rows={analysis.sections}
                    kind="section"
                  />
                  <DeltaTable
                    title="Largest symbol changes"
                    rows={analysis.symbols}
                    kind="symbol"
                  />
                </div>

                <section className="frame">
                  <div className="frame-rule flex items-center gap-2 px-4 py-3">
                    <AlertTriangle
                      size={14}
                      className="text-[#C5A36A]"
                    />
                    <h3 className="text-xs uppercase tracking-[.1em]">
                      Analyzer warnings
                    </h3>
                  </div>

                  {analysis.warnings.length ? (
                    <ul className="divide-y divide-[#4D594B]/60">
                      {analysis.warnings.map((warning, index) => (
                        <li
                          key={`${warning}-${index}`}
                          className="px-4 py-3 text-xs leading-5"
                          data-testid={`warning-${index}`}
                        >
                          {warning}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-4 text-xs text-[#A4AA9B]">
                      No warnings returned.
                    </p>
                  )}

                  <p className="border-t border-[#4D594B] px-4 py-3 text-[10px] leading-5 text-[#A4AA9B]">
                    Limitations: comparison detail is bounded by the analyzer
                    response. Optional metrics that are absent are not
                    inferred; size deltas alone do not establish the cause of
                    a change.
                  </p>
                </section>
              </section>
            </ScrollReveal>
          )}

          {!analysis && !loading && !error && (
            <ScrollReveal className="mt-4" delay={100}>
              <div
                className="flex items-center gap-2 text-[10px] text-[#A4AA9B]"
                aria-live="polite"
              >
                <span className="h-1.5 w-1.5 bg-[#8CAFC2]" />
                Awaiting a pair of ELF artifacts
              </div>
            </ScrollReveal>
          )}
        </main>

        <ScrollReveal className="mt-10" delay={80}>
          <footer className="flex flex-col gap-2 border-t border-[#4D594B] pt-3 text-[10px] text-[#A4AA9B] sm:flex-row sm:items-center sm:justify-between">
            <span>ELF SIZE DIFF</span>
            <span>Analyzer data only.</span>
          </footer>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default App;
