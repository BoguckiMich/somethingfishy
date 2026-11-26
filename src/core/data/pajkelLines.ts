import { timeOfDay } from '../clock';

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
  fog: ['Fog on the water. Spooky.', 'Misty out. Odd fish?', "Can't see the far shore."],
};

/** Said at dusk and at night instead of the day lines for the weathers that read as daytime ones. */
export const WEATHER_NIGHT_LINES: Partial<Record<WeatherLineId, readonly string[]>> = {
  sunny: ['Calm, clear night.', 'Not a ripple. Lovely.', 'Quiet water tonight.'],
  overcast: ['Cloudy night. Cosy.', 'Overcast. Good fishing.', 'Dark and grey. Perfect.'],
};

/** Unused since balance A2 (fog now stays visible the whole hour it is on); kept for a future fog that lifts. */
export const FOG_LIFTED_LINES: readonly string[] = ['The fog has lifted.', 'Fog is gone. Clear view.', 'Can see the far shore now.'];

/** The line that says what the weather is NOW: the weather change can come at any hour of the in-game day. */
export function weatherLinesFor(id: WeatherLineId, minute: number): readonly string[] {
  const tod = timeOfDay(minute);
  return (tod === 'dusk' || tod === 'night' ? WEATHER_NIGHT_LINES[id] : undefined) ?? WEATHER_LINES[id];
}
/** Pajkel on a new best at skipping pebbles, said the first time a record is beaten on a real date (slice 26). One bubble line each (about 25 characters). */
export const SKIP_RECORD_LINES: readonly string[] = ['New skip record. Humbling.', 'The water approves. Record!', 'I want a recount. Wow.', 'Pebble first, fish later.'];

/** Pajkel skips the pebbles (slice 26b): "One sec!" when the stones are tapped while he is busy; after a 5-skip throw; a small word after a lesser one (only now and then). */
export const ONE_SEC_LINE = 'One sec!';
export const SKIP_FIVE_LINES: readonly string[] = ['Five! Did you see that?', 'Five! Somebody write it down.', 'FIVE. I felt that one.'];
export const SKIP_MID_LINES: readonly string[] = ['Nice one.', 'That one had manners.', 'Good stone.'];
/** Bestia's one bark after a five-skip pebble. */
export const WOOF_TEXT = 'Woof!';
export const SKIP_LOW_LINES: readonly string[] = ['Plip.', 'It sank with dignity.', 'The stone tried.'];

/** Pajkel when she taps a stick in the middle of a round: he will throw it next (slice 26). */
export const NEXT_ONE_LINE = 'Next one!';
