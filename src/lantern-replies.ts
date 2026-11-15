const confidence = /\b(confiden(?:ce|t)|self[- ]?doubt|believe in myself)\b/i;
const followUp = /^(?:(?:then|please|can you)\s+)?(?:suggest(?: something)?|give me (?:an|one) example|what should i do|how)[.!?]*$/i;

export function confidenceReply(question: string, history: {role: string; text: string}[]) {
  if (confidence.test(question)) {
    return 'Pick one situation where you want to feel more confident. If it’s speaking up in class, write one sentence you could say and read it aloud once. That rehearsal is enough for today. Where would more confidence help you most?';
  }
  const previous = history.filter(message => message.role === 'user').at(-1);
  if (followUp.test(question.trim()) && previous && confidence.test(previous.text)) {
    return 'Try this today: choose a low-stakes moment to share one opinion. Start with “I liked ___ because ___.” Say it to someone you trust, or rehearse it out loud first. Afterwards, notice what you managed to do, even if you felt nervous.';
  }
}

export function usableReply(reply: string | undefined, question:string): reply is string {
  const normalize = (text:string)=>text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  return !!reply?.trim() && normalize(reply)!==normalize(question)
    && !/offer one brief everyday next step|answer the question directly in 2 to 4|give one specific, practical action|avoid medical advice, diagnosis|only suggest reversible actions|never say that you changed anything|you are lantern|<\|(?:im_start|system|assistant)/i.test(reply);
}

export function asksAboutRecords(question:string) {
  return /\b(my (?:logs?|ratings?|records?|data|score|progress)|how (much|many|long).{0,40}(log(?:ged)?|drink|drank|sleep|slept|walk(?:ed)?|record(?:ed)?)|what did I (log|record|eat)|(?:show|use|compare|summarize).{0,25}(?:logs?|ratings?|records?))\b/i.test(question);
}

export function guidedReply(question:string) {
  if (/\b(stress(?:ed)?|overwhelm(?:ed|ing)?|stuck|homework|studying)\b/i.test(question)) return 'Choose the one thing that needs your attention first. For the next two minutes, do only its first action, such as opening the assignment or writing its heading. Then decide whether to continue or pause.';
  if (/\b(sleep|wind.down|bedtime)\b/i.test(question)) return 'Choose one quiet thing you can repeat before bed. Tonight, try putting your phone aside and reading one page of something you enjoy.';
  if (/\b(habit|routine)\b/i.test(question)) return 'Attach a small habit to something you already do. After brushing your teeth tomorrow, try writing down one thing you want to make time for.';
  if (/\b(meal|food|lunch|dinner)\b/i.test(question)) return 'Build one meal around an ingredient you already have. Write down what else you could add, then choose the easiest time to prepare it.';
  if (/^(hi|hello|hey)[!. ]*$/i.test(question.trim())) return 'Hi, I’m Lantern. What would help right now: getting started, winding down, or building confidence?';
  return 'I can help you pick a smaller next step. What are you trying to do, and what’s making it hard to start?';
}
