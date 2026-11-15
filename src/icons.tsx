const paths: Record<string,string> = {
  Today:'M3 10l9-7 9 7v10H3z M9 20v-6h6v6',
  Progress:'M4 20h16 M7 16v-4 M12 16V8 M17 16V4',
  Health:'M12 20S3 15 3 8a5 5 0 019-2 5 5 0 019 2c0 7-9 12-9 12z',
  Plan:'M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5',
  Resources:'M12 6v15 M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2z',
  Settings:'M12 3l2 2 3-.2 1 2.8 2.5 1.6-.5 2.8.5 2.8-2.5 1.6-1 2.8-3-.2-2 2-2-2-3 .2-1-2.8L3.5 15l.5-3-.5-2.8L6 7.6l1-2.8 3 .2z M15 12a3 3 0 11-6 0 3 3 0 016 0',
  Sleep:'M20 15A9 9 0 019 4a9 9 0 1011 11z',
  Morning:'M16 12a4 4 0 11-8 0 4 4 0 018 0z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  Water:'M12 3c2 4 6 7 6 11a6 6 0 01-12 0c0-4 4-7 6-11z',
  Meal:'M5 3v5a3 3 0 006 0V3 M8 3v18 M18 21V3c-3 2-4 6-4 10h4',
  Movement:'M15 6a2 2 0 110-4 2 2 0 010 4 M6 12l4-4 4 1 3 4h4 M13 9l-3 7-5 4 M11 15l6 2 1 4',
  Check:'M5 12l4 4L19 6',
  More:'M5 12h.01 M12 12h.01 M19 12h.01',
};
export function Icon({name}:{name:string}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.Today}/></svg>;
}
