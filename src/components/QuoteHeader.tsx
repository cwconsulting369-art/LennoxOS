import { useMemo } from 'react';
import { Dumbbell } from 'lucide-react';

const QUOTES = [
  'Jeder Rep zaehlt - bleib dran!',
  'Staerke kommt von Konstanz, nicht von Perfektion.',
  'Dein zukuenftiges Ich wird dir danken.',
  'Schmerz ist voruebergehend, Stolz ist fuer immer.',
  'Ein Set nach dem anderen - du schaffst das!',
  'Die einzige schlechte Uebung ist die, die nicht gemacht wird.',
  'Ueberwinde dich selbst - Tag fuer Tag.',
  'Dein Koerper kann fast alles - es ist dein Geist, den du ueberzeugen musst.',
  'Gib nicht auf, wenn es wehtut - gib auf, wenn du fertig bist.',
  'Disziplin wiegt Talent auf.',
  'Der einzige Weg, es zu tun, ist, es zu tun.',
  'Fortschritt, nicht Perfektion.',
  'Trainiere in dem Maße, wie du leben willst.',
  'Jeder Tag ist eine Chance, besser zu werden.',
  'Lass den Schmerz deinen Erfolg definieren.',
  'Der Unterschied zwischen Versuch und Erfolg ist Durchhaltevermoegen.',
  'Kaempfe um jeden Zentimeter.',
  'Heute trainieren, morgen staerker sein.',
  'Es geht nicht darum, perfekt zu sein - es geht darum, besser zu werden.',
  'Trainiere den Koerper, staerke den Geist.',
];

export default function QuoteHeader() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const quote = useMemo(() => {
    const dayIndex = today.getDate() % QUOTES.length;
    return QUOTES[dayIndex];
  }, []);

  return (
    <div className="text-center space-y-3 py-4">
      <div className="flex items-center justify-center gap-3">
        <Dumbbell className="w-8 h-8 text-[#00e676]" />
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
          Fitness Tracker
        </h1>
        <Dumbbell className="w-8 h-8 text-[#00e676]" />
      </div>
      <p className="text-sm md:text-base text-gray-400 font-medium">{dateStr}</p>
      <p className="text-base md:text-lg text-[#00e676] italic font-medium max-w-2xl mx-auto px-4">
        &quot;{quote}&quot;
      </p>
    </div>
  );
}
