import { it } from 'vitest';
import { CHAPTERS, SCRIPT } from '../../src/story/chapters';
import { TASKS, TRAINERS } from '../../src/story/stopLoop';
import { STOPS } from '../../src/story/stops';
it('dump', () => {
  const short = (l: { who: string; role?: string; text: string; cond?: string; when?: string }) => `${l.role ?? l.who}${l.when ? '{' + l.when + '}' : ''}${l.cond ? '[' + l.cond + ']' : ''}: ${l.text.slice(0, 50)}`;
  for (const c of CHAPTERS) {
    console.log(`#### ${c.stop} card=${JSON.stringify(c.card)} music=${c.music} texts=${c.texts.length} scene=${c.arrivalScene.length} postcard=${c.postcard?.slice(0, 30)}`);
    console.log(' clue', c.station.clue?.label, c.station.clue?.lines.length, 'people', c.station.people.map((p) => p.id + ':' + p.lines.length).join(','), 'looks', c.station.looks.map((l) => l.id + ':' + l.lines.length).join(','), 'juice', c.station.juice.length);
    console.log(' follower chosen', Object.keys(c.follower.chosen).join(','), 'nopick', c.follower.noPicker.length, 'waiting', Object.keys(c.follower.waiting).join(','));
    console.log(' street looks', c.street.looks.map((l) => `${l.id}@${l.x}:${l.lines.length}${l.secret ? 'S' : ''}${l.sets ? '+' + l.sets : ''}`).join(' '));
    console.log(' street res', c.street.residents.map((r) => `${r.id}@${r.x}:${r.lines.length}${r.nodes ? 'C' : ''}`).join(' '));
    for (const r of c.rooms) console.log(`  room ${r.id} door ${r.doorX}${r.in ? ' in ' + r.in : ''} looks ${r.looks?.map((l) => l.id + ':' + l.lines.length + (l.secret ? 'S' : '')).join(',')} people ${r.people?.map((p) => p.id + ':' + p.lines.length).join(',')} enter ${r.onEnter?.nodes.length ?? '-'}`);
    const t = c.trainer;
    if (t) console.log(` trainer ${t.who} a ${t.a.intro.length}/${t.a.win.length}/${t.a.lose.length} b ${t.b.intro.length}/${t.b.win.length}/${t.b.lose.length} between ${t.between.length}`);
    console.log(` boss x${c.boss.x} ${c.boss.script.intro.length}/${c.boss.script.win.length}/${c.boss.script.lose.length} after ${c.boss.after.length} interlude ${c.interlude.length}`);
    const task = TASKS[c.stop];
    if (task) console.log(' task', task.kind, task.title, JSON.stringify(task, (k, v) => (k === 'text' ? String(v).slice(0, 25) : k === 'who' || k === 'id' || k === 'mood' || k === 'voice' ? undefined : v)).slice(0, 600));
  }
  console.log(STOPS.map((s) => s.battles.map((b) => `${b.name} vs ${b.versus}`).join(' | ')).join('\n'));
  console.log(SCRIPT[0].tutorial?.map(short), SCRIPT[0].tutorialAfter?.map(short));
  console.log(TRAINERS.stop02);
});
