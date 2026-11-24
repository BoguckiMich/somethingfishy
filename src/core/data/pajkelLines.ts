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

/** Pajkel on the day's weather, said on the first visit of each real date (slice 23b). One bubble line each (about 25 characters). */
export const WEATHER_LINES: Record<'sunny' | 'overcast' | 'rain' | 'windy' | 'fog', readonly string[]> = {
  sunny: ['Sunny and calm. Nice day!', 'Not a ripple. Lovely.', 'Sunny. Try the shallows.'],
  overcast: ['Grey sky. Fish like that.', 'Overcast. Good fishing.', 'Clouds today. Perfect.'],
  rain: ['Light rain. Faster bites!', 'A bit of rain. Carp time.', 'Rain! Nice and cosy.'],
  windy: ['Windy! Hold on tight.', 'Breezy. Pike will bite.', 'The bobber will drift.'],
  fog: ['Fog on the lake. Spooky.', 'Misty morning. Odd fish?', "Can't see the far shore."],
};
