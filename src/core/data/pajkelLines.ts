/**
 * What Pajkel says in his speech bubble. Plain ASCII only (VT323 has no emoji); each line must fit
 * one line of the bubble at 360 px wide (about 25 characters at the 25 px font). 
 */
export const RECORD_LINES: readonly string[] = ["That's a beast... hehe", 'New record!', 'Look at the size of it!'];

/** Pajkel at 02:00, off to nap in the car (slice 16). The socks one is an inside joke. */
export const BEDTIME_LINES: readonly string[] = ["I'm off to nap in the car. Bestia, come!", 'Too late for me... Bestia! Car!', 'I need to change my socks'];

/** Pajkel gives up chasing Bestia, who will not hand the stick over (slice 17). */
export const GIVE_UP_LINES: readonly string[] = ['Bestia, give!', 'No take, only throw?', 'Fine. Keep it.'];

/** The rare round where she does drop the stick at his feet. */
export const GIVE_BACK_LINE = '...thank you?';

/** Pajkel on a gold-star fish that is not also a new species or record (slice 19). Short: one line of the bubble. */
export const GOLD_LINES: readonly string[] = ['Gold! Look at that one!', 'A gold one! Wow!', 'Gold star, Alex!'];

/** Pajkel on a medal catch (slice 23f): a perfect catch of a gold-size fish. One bubble line each. */
export const MEDAL_LINES: readonly string[] = ['A MEDAL! Perfect, Alex!', 'Perfect catch! A medal!', 'Not one slip. A medal!'];

/** Pajkel on the day's weather, said on the first visit of each real date (slice 23b). One bubble line each (about 25 characters). */
export const WEATHER_LINES: Record<'sunny' | 'overcast' | 'rain' | 'windy' | 'fog', readonly string[]> = {
  sunny: ['Sunny and calm. Nice day!', 'Not a ripple. Lovely.', 'Sunny. Try the shallows.'],
  overcast: ['Grey sky. Fish like that.', 'Overcast. Good fishing.', 'Clouds today. Perfect.'],
  rain: ['Light rain. Faster bites!', 'A bit of rain. Carp time.', 'Rain! Nice and cosy.'],
  windy: ['Windy! Hold on tight.', 'Breezy. Pike will bite.', 'The bobber will drift.'],
  fog: ['Fog on the lake. Spooky.', 'Misty morning. Odd fish?', "Can't see the far shore."],
};

/** Pajkel on a new best at skipping pebbles, said the first time a record is beaten on a real date (slice 26). One bubble line each (about 25 characters). */
export const SKIP_RECORD_LINES: readonly string[] = ['New skip record. Humbling.', 'The lake approves. Record!', 'I want a recount. Wow.', 'Pebble first, fish later.'];

/** Pajkel when she taps a stick in the middle of a round: he will throw it next (slice 26). */
export const NEXT_ONE_LINE = 'Next one!';
