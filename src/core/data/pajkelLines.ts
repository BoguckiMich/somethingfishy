import { timeOfDay } from '../clock';
import { WEATHER_TUNING } from './weather';

type WeatherLineId = 'sunny' | 'overcast' | 'rain' | 'windy' | 'fog';

/**
 * What Pajkel says in his speech bubble. Plain ASCII only (VT323 has no emoji); each line must fit
 * one line of the bubble at 360 px wide (about 25 characters at the 25 px font). 
 */
export const RECORD_LINES: readonly string[] = ["That's a beast... hehe", 'New record!', 'Look at the size of it!'];

/** Pajkel at 02:00, off to nap in the car (slice 16). The socks one is an inside joke. */
export const BEDTIME_LINES: readonly string[] = ["I'm off to nap in the car. {dog}, come!", 'Too late for me... {dog}! Car!', 'I need to change my socks'];

/** Pajkel gives up chasing {dog}, who will not hand the stick over (slice 17). */
export const GIVE_UP_LINES: readonly string[] = ['{dog}, give!', 'No take, only throw?', 'Fine. Keep it.'];

/** The rare round where she does drop the stick at his feet. */
export const GIVE_BACK_LINE = '...thank you?';

/** Pajkel on a gold-star fish that is not also a new species or record (slice 19). Short: one line of the bubble. */
export const GOLD_LINES: readonly string[] = ['Gold! Look at that one!', 'A gold one! Wow!', 'Gold star, {player}!'];

/** Pajkel on a medal catch (slice 23f): a perfect catch of a gold-size fish. One bubble line each. */
export const MEDAL_LINES: readonly string[] = ['A MEDAL! Perfect, {player}!', 'Perfect catch! A medal!', 'Not one slip. A medal!'];

/** Pajkel on the day's weather, said on the first visit of each real date (slice 23b). One bubble line each (about 25 characters). */
export const WEATHER_LINES: Record<WeatherLineId, readonly string[]> = {
  sunny: ['Sunny and calm. Nice day!', 'Not a ripple. Lovely.', 'Sunny. Try the shallows.'],
  overcast: ['Grey sky. Fish like that.', 'Overcast. Good fishing.', 'Clouds today. Perfect.'],
  rain: ['Light rain. Faster bites!', 'A bit of rain. Carp time.', 'Rain! Nice and cosy.'],
  windy: ['Windy! Hold on tight.', 'Breezy. Pike will bite.', 'Hold on to your hat!'],
  fog: ['Fog on the water. Spooky.', 'Misty morning. Odd fish?', "Can't see the far shore."],
};

/** Said at dusk and at night instead of the day lines for the weathers that read as daytime ones. */
export const WEATHER_NIGHT_LINES: Partial<Record<WeatherLineId, readonly string[]>> = {
  sunny: ['Calm, clear night.', 'Not a ripple. Lovely.', 'Quiet water tonight.'],
  overcast: ['Cloudy night. Cosy.', 'Overcast. Good fishing.', 'Dark and grey. Perfect.'],
};

/** Fog only lives until 10:00 (and not at night): a fog hour that is read later in the day says it has lifted. */
export const FOG_LIFTED_LINES: readonly string[] = ['The fog has lifted.', 'Fog is gone. Clear view.', 'Can see the far shore now.'];

/** The line that says what the weather is NOW: the weather change can come at any hour of the in-game day. */
export function weatherLinesFor(id: WeatherLineId, minute: number): readonly string[] {
  const tod = timeOfDay(minute);
  if (id === 'fog') return minute >= (WEATHER_TUNING.fog.untilMinute ?? 600) || tod === 'night' ? FOG_LIFTED_LINES : WEATHER_LINES.fog;
  return (tod === 'dusk' || tod === 'night' ? WEATHER_NIGHT_LINES[id] : undefined) ?? WEATHER_LINES[id];
}
