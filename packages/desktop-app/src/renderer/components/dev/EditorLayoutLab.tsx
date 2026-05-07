import { useMemo, useState, type JSX } from 'react';
import {
  Braces,
  ChevronRight,
  CircleDot,
  FileText,
  Hash,
  Layers3,
  ListTree,
  PanelRight,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

type LayoutOption = 'document' | 'inspector' | 'modes' | 'compact' | 'summary' | 'command';

const layoutOptions: Array<{
  id: LayoutOption;
  title: string;
  caption: string;
}> = [
  {
    id: 'document',
    title: '문서형',
    caption: '컨셉 자체를 먼저 읽고 쓰는 화면',
  },
  {
    id: 'inspector',
    title: 'Inspector',
    caption: '중앙은 내용, 우측은 속성',
  },
  {
    id: 'modes',
    title: '작업 모드',
    caption: '내용, 구조, 표시, 메타를 분리',
  },
  {
    id: 'compact',
    title: 'Compact',
    caption: '현재 accordion을 가볍게 재정렬',
  },
  {
    id: 'summary',
    title: 'Summary',
    caption: '요약에서 상세로 들어가는 방식',
  },
  {
    id: 'command',
    title: 'Command',
    caption: '화면은 조용하게, 작업은 호출형',
  },
];

const relationRows = [
  { label: '포함', value: 'Contains', meta: 'contains_relation' },
  { label: '근거', value: 'References', meta: 'source_link' },
  { label: '변형', value: 'Refines', meta: 'concept_delta' },
];

const detailRows = [
  { label: '모델', value: '개념', tone: '핵심' },
  { label: '의미', value: '3개', tone: '구조' },
  { label: '규칙', value: '없음', tone: '비어 있음' },
  { label: '소스처', value: '2개', tone: '연결' },
  { label: '시각값', value: '기본값 사용', tone: '표시' },
  { label: '메타데이터', value: '생성일, 수정일', tone: '고급' },
];

interface EditorLayoutLabProps {
  onClose?: () => void;
}

export function EditorLayoutLab({ onClose }: EditorLayoutLabProps): JSX.Element {
  const [selected, setSelected] = useState<LayoutOption>('inspector');
  const selectedOption = useMemo(
    () => layoutOptions.find((option) => option.id === selected) ?? layoutOptions[0],
    [selected],
  );

  return (
    <div className="min-h-screen bg-surface-editor text-default">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-5">
        <header className="flex flex-col gap-4 border-b border-default pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Sparkles size={14} />
              <span>Editor Layout Lab</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-default">네트워크 객체 에디터 실험실</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
              같은 컨셉 데이터를 여러 편집 방식으로 놓고 비교하는 임시 개발 페이지입니다. 카드 구분을 유지할지,
              inspector로 보낼지, 작업 모드로 쪼갤지 감각적으로 확인하는 용도입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onClose && (
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                <X size={14} />
                닫기
              </Button>
            )}
            {layoutOptions.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="secondary"
                size="sm"
                isActive={selected === option.id}
                onClick={() => setSelected(option.id)}
              >
                {option.title}
              </Button>
            ))}
          </div>
        </header>

        <main className="grid min-h-0 flex-1 gap-5 py-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-h-0 rounded-lg border border-subtle bg-surface-panel p-3">
            <div className="px-2 pb-3 text-xs font-medium text-muted">검토 방향</div>
            <div className="space-y-1">
              {layoutOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option.id)}
                  className={[
                    'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors',
                    selected === option.id ? 'bg-state-selected text-accent' : 'text-default hover:bg-state-hover',
                  ].join(' ')}
                >
                  <CircleDot size={14} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{option.caption}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden rounded-lg border border-default bg-surface-panel">
            <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-default">{selectedOption.title}</div>
                <div className="mt-0.5 text-xs text-muted">{selectedOption.caption}</div>
              </div>
              <Badge variant="accent">Prototype</Badge>
            </div>
            <div className="editor-scrollbar h-[calc(100vh-190px)] min-h-[620px] overflow-y-auto">
              {selected === 'document' && <DocumentLayout />}
              {selected === 'inspector' && <InspectorLayout />}
              {selected === 'modes' && <ModeLayout />}
              {selected === 'compact' && <CompactLayout />}
              {selected === 'summary' && <SummaryLayout />}
              {selected === 'command' && <CommandLayout />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function ObjectHeader({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md border border-subtle bg-surface-card">
          <Layers3 size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={compact ? 'text-lg font-semibold' : 'text-2xl font-semibold'}>새 개념</h2>
            <Badge variant="accent">개념</Badge>
          </div>
          <p className="mt-1 text-sm text-secondary">네트워크 오브젝트</p>
        </div>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-secondary">
        포함, 구성, 소속처럼 한 노드가 다른 노드를 담는 관계를 표현합니다. 이 문장은 컨셉을 열었을 때
        사용자가 가장 먼저 확인하는 요약 본문 역할을 가정합니다.
      </p>
    </div>
  );
}

function DocumentLayout(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <ObjectHeader />
      <div className="mt-8 border-t border-subtle pt-6">
        <div className="text-xs font-medium uppercase text-muted">본문</div>
        <div className="mt-3 min-h-[220px] rounded-md border border-subtle bg-surface-editor px-4 py-4 text-sm leading-7 text-secondary">
          이 영역은 컨셉의 중심 내용을 직접 쓰는 문서형 공간입니다. 구조 정의, 시각 기본값, 내부 메타데이터는
          기본 화면에서 밀어내고, 컨셉이 설명하려는 내용과 연결된 파일을 먼저 보여줍니다.
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <InlineMetric icon={<ListTree size={15} />} label="주요 관계" value="Contains 외 2개" />
        <InlineMetric icon={<FileText size={15} />} label="연결 파일" value="2개" />
        <InlineMetric icon={<Hash size={15} />} label="필드" value="없음" />
      </div>
      <QuietDetails />
    </div>
  );
}

function InspectorLayout(): JSX.Element {
  return (
    <div className="grid min-h-full gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="px-8 py-8">
        <ObjectHeader />
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-default">핵심 내용</h3>
            <Button type="button" variant="ghost" size="sm">
              편집
            </Button>
          </div>
          <div className="min-h-[260px] rounded-md border border-subtle bg-surface-editor p-4 text-sm leading-7 text-secondary">
            중앙 영역은 사용자가 자주 보는 설명, 본문, 연결 파일만 담습니다. 덜 자주 쓰는 구조 데이터는 우측
            inspector에서 compact row로 관리합니다.
          </div>
        </section>
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-default">관계 요약</h3>
          <div className="grid gap-2">
            {relationRows.map((row) => (
              <CompactRelationRow key={row.meta} {...row} />
            ))}
          </div>
        </section>
      </div>
      <aside className="border-l border-subtle bg-surface-card px-4 py-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <PanelRight size={16} />
          <span>Inspector</span>
        </div>
        <InspectorGroup title="개요" rows={detailRows.slice(0, 2)} />
        <InspectorGroup title="연결" rows={detailRows.slice(2, 4)} />
        <InspectorGroup title="고급" rows={detailRows.slice(4)} />
      </aside>
    </div>
  );
}

function ModeLayout(): JSX.Element {
  return (
    <div className="px-8 py-8">
      <ObjectHeader compact />
      <div className="mt-6 flex flex-wrap gap-2 border-b border-subtle pb-3">
        {[
          ['내용', '본문과 연결 파일'],
          ['구조', '의미, 규칙, 필드'],
          ['표시', '색상, 아이콘, 기본 모양'],
          ['메타', 'ID와 내부 정보'],
        ].map(([label, caption], index) => (
          <button
            key={label}
            type="button"
            className={[
              'rounded-md px-3 py-2 text-left transition-colors',
              index === 0 ? 'bg-state-selected text-accent' : 'text-secondary hover:bg-state-hover',
            ].join(' ')}
          >
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted">{caption}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-md border border-subtle bg-surface-editor p-5">
          <h3 className="text-sm font-semibold">내용 모드</h3>
          <p className="mt-3 text-sm leading-7 text-secondary">
            사용자가 지금 수행하려는 작업만 한 화면에 둡니다. 구조 작업이 필요할 때는 구조 탭으로 넘어가므로
            접힌 카드 목록을 계속 스캔하지 않아도 됩니다.
          </p>
          <div className="mt-5 grid gap-3">
            <FieldPreview label="제목" value="새 개념" />
            <FieldPreview label="설명" value="포함 관계를 설명하는 컨셉" multiline />
          </div>
        </div>
        <div className="space-y-2">
          {detailRows.map((row) => (
            <StatusLine key={row.label} {...row} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactLayout(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <ObjectHeader compact />
      <div className="mt-6 space-y-2">
        <OpenCompactSection title="개요">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldPreview label="모델 이름" value="새 개념" />
            <FieldPreview label="대상" value="개념" />
            <FieldPreview label="분류" value="네트워크 오브젝트" />
            <FieldPreview label="설명" value="포함, 구성, 소속 관계를 표현합니다." multiline />
          </div>
        </OpenCompactSection>
        {detailRows.slice(1).map((row) => (
          <button
            key={row.label}
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-subtle bg-surface-card px-4 py-3 text-left hover:bg-state-hover"
          >
            <span className="flex items-center gap-3">
              <ChevronRight size={14} className="text-muted" />
              <span className="text-sm font-medium">{row.label}</span>
            </span>
            <span className="text-xs text-muted">{row.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryLayout(): JSX.Element {
  return (
    <div className="px-8 py-8">
      <ObjectHeader compact />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {detailRows.map((row) => (
          <button
            key={row.label}
            type="button"
            className="rounded-md border border-subtle bg-surface-card p-4 text-left hover:bg-state-hover"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{row.label}</div>
                <div className="mt-1 text-xs text-muted">{row.tone}</div>
              </div>
              <ChevronRight size={16} className="text-secondary" />
            </div>
            <div className="mt-4 text-sm text-secondary">{row.value}</div>
          </button>
        ))}
      </div>
      <div className="mt-6 rounded-md border border-subtle bg-surface-editor p-4">
        <div className="text-sm font-semibold">상세 패널 자리</div>
        <p className="mt-2 text-sm leading-6 text-secondary">
          위 요약 항목을 선택하면 이 영역이나 우측 drawer에 상세 편집기가 열리는 흐름입니다.
        </p>
      </div>
    </div>
  );
}

function CommandLayout(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <ObjectHeader />
      <div className="mt-8 rounded-md border border-default bg-surface-editor p-3">
        <div className="flex items-center gap-3 rounded-md border border-subtle bg-surface-panel px-3 py-2">
          <Search size={16} className="text-muted" />
          <span className="text-sm text-muted">작업 검색: 의미 추가, 규칙 편집, 소스처 연결...</span>
        </div>
        <div className="mt-3 grid gap-2">
          {[
            ['의미 추가', '관계의 표현 방식과 필드를 정의합니다.', <Braces key="meaning" size={16} />],
            ['시각 기본값 변경', '아이콘, 색상, 선 스타일을 조정합니다.', <Settings2 key="visual" size={16} />],
            ['소스처 연결', '파일이나 외부 근거를 연결합니다.', <FileText key="source" size={16} />],
          ].map(([title, caption, icon]) => (
            <button
              key={String(title)}
              type="button"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-state-hover"
            >
              <span className="text-secondary">{icon}</span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted">{caption}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <QuietDetails />
    </div>
  );
}

function QuietDetails(): JSX.Element {
  return (
    <div className="mt-8 border-t border-subtle pt-4">
      <div className="flex flex-wrap gap-2">
        {detailRows.map((row) => (
          <span key={row.label} className="rounded-md bg-surface-card px-2.5 py-1 text-xs text-secondary">
            {row.label}: {row.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function InlineMetric({ icon, label, value }: { icon: JSX.Element; label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-subtle bg-surface-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-medium text-default">{value}</div>
    </div>
  );
}

function CompactRelationRow({ label, value, meta }: { label: string; value: string; meta: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-subtle bg-surface-card px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="truncate text-xs text-muted">{meta}</div>
      </div>
      <Badge variant="default">{value}</Badge>
    </div>
  );
}

function InspectorGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; tone: string }>;
}): JSX.Element {
  return (
    <div className="mb-5">
      <div className="mb-2 text-xs font-medium uppercase text-muted">{title}</div>
      <div className="space-y-1">
        {rows.map((row) => (
          <StatusLine key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: string }): JSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-state-hover"
    >
      <span className="min-w-0">
        <span className="block text-sm text-default">{label}</span>
        <span className="block text-xs text-muted">{tone}</span>
      </span>
      <span className="shrink-0 text-xs text-secondary">{value}</span>
    </button>
  );
}

function FieldPreview({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }): JSX.Element {
  return (
    <label className="block">
      <span className="text-xs font-medium text-secondary">{label}</span>
      <span
        className={[
          'mt-1 block rounded-md border border-subtle bg-surface-panel px-3 py-2 text-sm text-secondary',
          multiline ? 'min-h-20' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </label>
  );
}

function OpenCompactSection({ title, children }: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <section className="rounded-md border border-default bg-surface-card">
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
        <ChevronRight size={14} className="rotate-90 text-secondary" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
