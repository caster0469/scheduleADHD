import { useEffect, useMemo, useState } from 'react';

type Tab = 'home' | 'calendar' | 'todo';
type ItemType = 'task' | 'move' | 'event' | 'deadline';

type Item = {
  id: string;
  type: ItemType;
  category: string;
  title: string;
  date: string;
  time: string | null;
  durationMin: number | null;
  firstStep: string | null;
  done: boolean;
};

type Todo = {
  id: string;
  emoji: string;
  label: string;
  title: string;
  sub: string | null;
  done: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const dateStr = new Date().toISOString().slice(0, 10);

const categoryMap: Record<string, { emoji: string; label: string }> = {
  study: { emoji: '📓', label: '勉強' },
  meal: { emoji: '🍚', label: '食事' },
  move: { emoji: '🚶', label: '移動' },
  bath: { emoji: '🛁', label: '風呂' },
  message: { emoji: '💬', label: '連絡' },
  chores: { emoji: '🧺', label: '家事' },
  rest: { emoji: '🛌', label: '休憩' },
  hobby: { emoji: '🎮', label: '趣味' }
};

const itemTypeLabel: Record<ItemType, string> = { task: '作業', move: '移動', event: '予定', deadline: '締切' };

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [items, setItems] = useState<Item[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateStr);
  const [draftOpen, setDraftOpen] = useState(false);
  const [todoFilter, setTodoFilter] = useState<'all' | 'open' | 'today' | 'week'>('open');
  const [itemDraft, setItemDraft] = useState({ type: 'task', category: 'study', title: '', date: dateStr, time: '', durationMin: '', firstStep: '' });

  const [timerTarget, setTimerTarget] = useState<string | null>(null);
  const [timerSec, setTimerSec] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  const isDesktop = window.matchMedia('(min-width: 768px)').matches;

  async function fetchAll() {
    const [itemRes, todoRes] = await Promise.all([
      fetch(`${API_BASE}/api/items?date=${selectedDate}`),
      fetch(`${API_BASE}/api/todos`)
    ]);
    setItems(await itemRes.json());
    setTodos(await todoRes.json());
  }

  useEffect(() => {
    void fetchAll();
  }, [selectedDate]);

  useEffect(() => {
    if (!timerRunning || timerSec <= 0) return;
    const id = setInterval(() => setTimerSec((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerSec]);

  const nowItem = useMemo(() => items.find((i) => !i.done) ?? null, [items]);

  async function addItem() {
    await fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...itemDraft,
        durationMin: itemDraft.durationMin ? Number(itemDraft.durationMin) : null,
        time: itemDraft.time || null,
        firstStep: itemDraft.firstStep || null
      })
    });
    setDraftOpen(false);
    setItemDraft({ ...itemDraft, title: '', time: '', durationMin: '', firstStep: '' });
    await fetchAll();
  }

  async function patchItem(id: string, payload: Partial<Item>) {
    await fetch(`${API_BASE}/api/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await fetchAll();
  }

  async function addTodo() {
    await fetch(`${API_BASE}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '📝', label: 'メモ', title: '新しいTODO', sub: '最初の一手' })
    });
    await fetchAll();
  }

  const filteredTodos = todos.filter((t) => {
    if (todoFilter === 'open') return !t.done;
    return true;
  });

  const min = Math.floor(timerSec / 60);
  const sec = `${timerSec % 60}`.padStart(2, '0');

  return (
    <div className="app">
      <aside className="sideNav">
        <button onClick={() => setTab('home')} className={tab === 'home' ? 'active' : ''}>🏠 ホーム</button>
        <button onClick={() => setTab('calendar')} className={tab === 'calendar' ? 'active' : ''}>📅 カレンダー</button>
        <button onClick={() => setTab('todo')} className={tab === 'todo' ? 'active' : ''}>✅ TODO</button>
      </aside>

      <main className="main">
        {tab === 'home' && (
          <section>
            <h1>今日のフロー</h1>
            <div className="rail" />
            <div className="nowLabel">NOW</div>
            {nowItem && (
              <FlowNode item={nowItem} now big onComplete={() => patchItem(nowItem.id, { done: true })} onTimer={() => { setTimerTarget(nowItem.id); setTimerSec(300); setTimerRunning(true); }} onPostpone={(mins) => patchItem(nowItem.id, { postponedUntil: new Date(Date.now() + mins * 60_000).toISOString() })} />
            )}
            <div className="next">次にやる</div>
            {items.filter((i) => i.id !== nowItem?.id).map((item) => (
              <FlowNode key={item.id} item={item} onComplete={() => patchItem(item.id, { done: true })} />
            ))}
            <button className="addBtn" onClick={() => setDraftOpen(true)}>＋ やることを追加</button>
          </section>
        )}

        {tab === 'calendar' && <CalendarView items={items} selectedDate={selectedDate} onDate={setSelectedDate} onAdd={() => setDraftOpen(true)} />}

        {tab === 'todo' && (
          <section>
            <h1>TODO</h1>
            <div className="todoFilter">
              <button onClick={() => setTodoFilter('open')}>未完了</button>
              <button onClick={() => setTodoFilter('today')}>今日</button>
              <button onClick={() => setTodoFilter('week')}>今週</button>
            </div>
            <button className="addBtn" onClick={addTodo}>＋ 新規TODO</button>
            {filteredTodos.map((t) => (
              <div className="todoRow" key={t.id} onClick={() => fetch(`${API_BASE}/api/todos/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !t.done }) }).then(fetchAll)}>
                <div className="cat">{t.emoji}<span>{t.label}</span></div>
                <div>
                  <strong>{t.title}</strong>
                  <p>{t.sub}</p>
                </div>
                <input readOnly type="checkbox" checked={t.done} />
              </div>
            ))}
          </section>
        )}
      </main>

      <aside className="detailPanel">
        <h3>詳細 / ミニタイマー</h3>
        {timerTarget ? (
          <div className="timerCard">
            <div className="bar"><span style={{ width: `${(timerSec / 300) * 100}%` }} /></div>
            <p>{min}:{sec}</p>
            <div className="timerActions">
              <button onClick={() => setTimerSec((s) => s + 120)}>+2分</button>
              <button onClick={() => setTimerRunning((s) => !s)}>{timerRunning ? '一時停止' : '再開'}</button>
              <button onClick={() => { setTimerRunning(false); setTimerTarget(null); }}>完了</button>
            </div>
            {timerSec <= 0 && <div className="timerDone"><button onClick={() => setTimerSec(600)}>続ける(+10分)</button><button onClick={() => { setTimerTarget(null); setTimerRunning(false); }}>終わる</button></div>}
          </div>
        ) : <p>「5分だけ」を押すと表示されます。</p>}
      </aside>

      {!isDesktop && (
        <nav className="bottomNav">
          <button onClick={() => setTab('home')} className={tab === 'home' ? 'active' : ''}>ホーム</button>
          <button onClick={() => setTab('calendar')} className={tab === 'calendar' ? 'active' : ''}>カレンダー</button>
          <button onClick={() => setTab('todo')} className={tab === 'todo' ? 'active' : ''}>TODO</button>
        </nav>
      )}

      {draftOpen && (
        <div className="sheetBackdrop" onClick={() => setDraftOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>予定を追加</h3>
            <select value={itemDraft.type} onChange={(e) => setItemDraft({ ...itemDraft, type: e.target.value })}>{['task', 'move', 'event', 'deadline'].map((t) => <option key={t}>{t}</option>)}</select>
            <input placeholder="title" value={itemDraft.title} onChange={(e) => setItemDraft({ ...itemDraft, title: e.target.value })} />
            <input type="date" value={itemDraft.date} onChange={(e) => setItemDraft({ ...itemDraft, date: e.target.value })} />
            <input type="time" value={itemDraft.time} onChange={(e) => setItemDraft({ ...itemDraft, time: e.target.value })} />
            <input placeholder="durationMin" value={itemDraft.durationMin} onChange={(e) => setItemDraft({ ...itemDraft, durationMin: e.target.value })} />
            <input placeholder="firstStep" value={itemDraft.firstStep} onChange={(e) => setItemDraft({ ...itemDraft, firstStep: e.target.value })} />
            <button onClick={addItem}>追加</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowNode({ item, now, big, onComplete, onTimer, onPostpone }: { item: Item; now?: boolean; big?: boolean; onComplete?: () => void; onTimer?: () => void; onPostpone?: (mins: number) => void }) {
  const cat = categoryMap[item.category] ?? { emoji: '📝', label: item.category };
  return (
    <article className={`node ${item.type} ${big ? 'big' : ''}`}>
      <div className="time">{item.time ?? '--:--'}</div>
      <div className="card">
        <div className="cat">{cat.emoji}<span>{cat.label}</span></div>
        <div>
          <h3>{item.title}</h3>
          <p>{item.firstStep ?? `${itemTypeLabel[item.type]} ${item.durationMin ?? ''}分`}</p>
        </div>
      </div>
      {now && (
        <div className="actions">
          <button>▶ 開始</button>
          <button onClick={onTimer}>⏱ 5分だけ</button>
          <button onClick={() => onPostpone?.(15)}>↻ 後で15分</button>
          <button onClick={onComplete}>✓ 完了</button>
        </div>
      )}
      {!now && <button className="done" onClick={onComplete}>✓</button>}
    </article>
  );
}

function CalendarView({ items, selectedDate, onDate, onAdd }: { items: Item[]; selectedDate: string; onDate: (d: string) => void; onAdd: () => void }) {
  const today = new Date(selectedDate);
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - startWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  return (
    <section>
      <h1>カレンダー</h1>
      <div className="calendarLayout">
        <div className="grid">
          {cells.map((d, i) => (
            <button key={i} className={d === Number(selectedDate.slice(-2)) ? 'active' : ''} onClick={() => d && onDate(`${selectedDate.slice(0, 8)}${`${d}`.padStart(2, '0')}`)}>
              {d}
              {d && items.length > 0 && <span className="dot" />}
            </button>
          ))}
        </div>
        <div className="dayList">
          <h3>{selectedDate}</h3>
          {items.map((item) => <div key={item.id} className={`mini ${item.type}`}>{item.time} {item.title}</div>)}
          <button className="addBtn" onClick={onAdd}>＋ 追加</button>
        </div>
      </div>
    </section>
  );
}
