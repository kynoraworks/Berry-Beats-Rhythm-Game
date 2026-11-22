import type { CutLine, Emotion } from './speakers';

/**
 * The cutscenes' words, line for line from docs/story_v2/STORY_BIBLE_V2.md
 * (sections 5, 7 and 8). Lines with an `if` play only when it holds (see
 * conditions.ts). Stage directions live in the scenes themselves.
 */

const l = (who: string, mood: Emotion, text: string, condition?: string): CutLine => (condition ? { who, mood, text, if: condition } : { who, mood, text });

// ---------------------------------------------------------------------------
// 5.1 The hype sequence (spoken as callouts, no input)
// ---------------------------------------------------------------------------

export const HYPE_LINES = {
  awake: l('orangeYoung', 'bold', '{big}FRUIT CITY!{/big} Are you {shake}AWAKE?{/shake}'),
  left: l('orangeYoung', 'bold', 'On my left, she came up from the bog with mud on her boots!'),
  cranberry: l('orangeYoung', 'bold', '{colour=#c8102e}{big}THE BOG QUEEN!{/big}{/colour} CRANBERRY!'),
  right: l('orangeYoung', 'bold', 'On my right, four titles, zero losses, zero chill!'),
  strawberry: l('orangeYoung', 'bold', '{colour=#e8243c}{sparkle}THE SUMMER LEGEND!{/sparkle}{/colour} STRAWBERRY!'),
  evening: l('strawberry', 'smug', '{wave}Evening, Cran.{/wave} Try not to trip.'),
  saveBreath: l('cranberry', 'bold', "Save your breath, Straw. You'll need it in the last chorus."),
};

// ---------------------------------------------------------------------------
// 5.3 The garden shed
// ---------------------------------------------------------------------------

export const SHED_LINES: readonly CutLine[] = [
  l('kidRaspberry', 'shocked', '{big}NO!{/big}'),
  l('kidRaspberry', 'angry', 'No no no no. {shake}Turn it back on!{/shake}'),
  l('kidBlueberry', 'bold', "I'm on it. {act}thumps the telly{/act}"),
  l('kidBlueberry', 'shocked', "It's not working. Why is it not working?!"),
  l('kidBerry', 'soft', 'I think the whole sky broke.'),
  l('kidRaspberry', 'angry', '{big}WHO WON?{/big}'),
  l('kidBlueberry', 'smug', 'Strawberry. Obviously. She never loses.'),
  l('kidRaspberry', 'angry', 'The Bog Queen had her! She had her by the {shake}boots!{/shake}'),
  l('kidBlueberry', 'smug', "Then she fell over. If you fall in a final, you lose. That's the rule."),
  l('kidRaspberry', 'angry', 'That is NOT a rule. You made that up just now.'),
  l('kidBlueberry', 'bold', "I'm going to be like Strawberry. Undefeated. My face on posters."),
  l('kidRaspberry', 'bold', "I'm going to be the Bog Queen. I'm going to get mud on everything."),
  l('kidRaspberry', 'smug', "Mum's going to love it."),
  l('kidBlueberry', 'happy', 'What about you, Berry?'),
  l('kidBerry', 'soft', "{wave}Did you see Strawberry's face? Right at the end?{/wave}"),
  l('kidBerry', 'soft', "She wasn't doing her pose. She turned round. Like she was going to catch her."),
  l('kidBlueberry', 'neutral', "Legends don't catch people. Legends win."),
  l('kidBerry', 'happy', 'Then I want to be the other thing.'),
  l('kidRaspberry', 'neutral', "There's no other thing. You win or you lose."),
  l('kidBerry', 'bold', "We don't know how it ends. So we make our own ending."),
  l('kidBerry', 'bold', 'Right now. In the garden. Come on!'),
];

/** Out on the grass: the step, the spin and the drop, one line each, then the catch. */
export const GARDEN_STEP: readonly CutLine[] = [l('kidBerry', 'bold', "I'm the step. {act}does a wobbly step-slide{/act}")];
export const GARDEN_SPIN: readonly CutLine[] = [
  l('kidRaspberry', 'bold', "I'm the spin! {act}spins, falls into a hedge{/act}"),
  l('kidRaspberry', 'happy', "I'm fine. The hedge is fine. Keep going."),
];
export const GARDEN_DROP: readonly CutLine[] = [
  l('kidBlueberry', 'bold', "And I'm the big drop at the end, because I'm the best one."),
  l('kidBlueberry', 'shocked', '{act}drops, wobbles, goes over backwards{/act} {shake}Whoa-{/shake}'),
];
export const GARDEN_PROMISE: readonly CutLine[] = [
  l('kidBerry', 'happy', 'See? If one of us falls, the other two catch.'),
  l('kidBlueberry', 'soft', "{small}...that's not a rule either.{/small}"),
  l('kidBerry', 'happy', "It is now. It's the Trio Turn."),
  l('kidRaspberry', 'bold', "The Trio Turn! We're doing it at the Grand Dance. All three of us."),
  l('kidBlueberry', 'bold', "We'll be so good they'll have to make a new trophy."),
  l('kidBerry', 'happy', 'Promise?'),
  l('kidRaspberry', 'bold', 'Promise.'),
  l('kidBlueberry', 'bold', 'Promise. {pause} Even if you get boring and quiet.'),
  l('kidBerry', 'happy', "I'll never get quiet."),
];

// ---------------------------------------------------------------------------
// 7.3 After the last note
// ---------------------------------------------------------------------------

export const FINALE_DISBELIEF: readonly CutLine[] = [l('blueberry', 'shocked', '{slow}No.{/slow} {pause} No, no. I can do it. I can do it with one.')];
export const FINALE_NOT_THIS_TIME: readonly CutLine[] = [l('orange', 'bold', '{big}NOT. THIS. TIME.{/big}')];
export const FINALE_BOW_REFUSE: readonly CutLine[] = [l('berry', 'bold', '{shake}No.{/shake}')];

// ---------------------------------------------------------------------------
// 7.4 On the stage, and the postcards
// ---------------------------------------------------------------------------

export const ON_STAGE: readonly CutLine[] = [
  l('blueberry', 'soft', '{slow}...You caught me.{/slow}'),
  l('berry', 'soft', 'If one of us falls, the other two catch.'),
  l('blueberry', 'soft', "That's not a rule."),
  l('berry', 'happy', 'It is now.'),
  l('blueberry', 'neutral', "You didn't hide. Not once."),
  l('berry', 'bold', "I should have said yes. In July. I'm saying it now."),
  l('berry', 'bold', 'Yes.'),
  l('blueberry', 'soft', '{slow}You were supposed to say that in July.{/slow}'),
  l('blueberry', 'sad', "I sent the ticket. I couldn't ask twice. So I got everyone else to ask for me."),
  l('blueberry', 'sad', 'Every gate on the Line. Every one of them was me asking.'),
  l('raspberry', 'angry', "You absolute muffin. {pause} Both of you. {pause} All three of us. We're all muffins."),
  l('blueberry', 'neutral', 'Two knocks. Backstage. {pause} I nearly opened the door.', 'flag:knocked'),
  l('blueberry', 'soft', "The step-slide. I never stopped dancing it. It's yours too. It was always yours."),
];

/** Berry takes a stack of postcards out of his hoodie pocket. The lines depend on how many he wrote. */
export const POSTCARD_LINES: readonly CutLine[] = [
  l('berry', 'soft', 'I wrote you these. I never sent them.', 'postcards>=1'),
  l('blueberry', 'shocked', '{slow}Eleven postcards.{/slow} You never sent one. You wrote me eleven.', 'postcards=11'),
  l('blueberry', 'shocked', '{slow}A whole stack.{/slow} You never sent one.', 'postcards>=5 & postcards<11'),
  l('blueberry', 'soft', "A few postcards. {pause} That's a few more than I got.", 'postcards>=1 & postcards<5'),
  l('blueberry', 'smug', '{act}reads one{/act} "You look taller." {pause} I do look taller.', 'postcards>=1'),
  l('blueberry', 'soft', '{act}reads another{/act} "I won. Everyone left. I think it\'s me." {pause} Me too, Berry.', 'postcards>=7'),
  l('berry', 'soft', "I meant to write to you. I never did. So I'm saying it instead.", 'postcards=0'),
  l('blueberry', 'soft', "{pause} That's better than a postcard.", 'postcards=0'),
];

// ---------------------------------------------------------------------------
// 7.5 The envelope
// ---------------------------------------------------------------------------

export const ENVELOPE_COACH: readonly CutLine[] = [l('berry', 'neutral', 'One more thing.'), l('berry', 'bold', 'Coach.')];
export const ENVELOPE_CONDUCTOR: readonly CutLine[] = [l('berry', 'bold', '{pause} And the Conductor.')];
export const ENVELOPE_REVEAL: readonly CutLine[] = [
  l('orange', 'shocked', '{pause} Is that...'),
  l('orange', 'bold', 'Folks. I have waited eight years to say this name into a working microphone.'),
  l('orange', 'bold', '{big}{colour=#e8243c}STRAWBERRY!{/colour}{/big}'),
];
export const ENVELOPE_MEET: readonly CutLine[] = [
  l('coach', 'soft', 'Hello, Straw.'),
  l('strawberry', 'soft', 'Hello, Cran. {pause} You look floury.'),
  l('coach', 'smug', 'You look like a train.'),
  l('strawberry', 'neutral', 'I am a train. Mostly. {pause} Eight years of trains.'),
  l('berry', 'soft', 'This is yours. Both of yours. {act}holds out the envelope{/act}'),
  l('coach', 'neutral', '{act}turns it over{/act} "For C. and S. only."'),
  l('strawberry', 'shocked', 'I never knew there was one. They told me "no result". I believed them.'),
  l('coach', 'neutral', "{act}holds it out to Raspberry{/act} You've asked me every week for eight years. You read it."),
  l('raspberry', 'shocked', 'Me? {pause} Are you... {pause} {shake}Give it.{/shake}'),
];
export const ENVELOPE_READ: readonly CutLine[] = [
  l('raspberry', 'shocked', '"Winner..." {pause=1.2}'),
  l('raspberry', 'shocked', '"Cranberry." {pause} "By two points."'),
];
export const ENVELOPE_AFTER: readonly CutLine[] = [
  l('raspberry', 'bold', '{big}SHE WON!{/big} {shake}SHE WON AND SHE NEVER TOLD US!{/shake}'),
  l('coach', 'shocked', '{pause} ...Two?'),
  l('strawberry', 'happy', '{voice=strawberry}Two. You had me by two, Cran. You always had me by two.{/voice}'),
  l('coach', 'sad', 'I thought you caught me because I was losing. Because you felt sorry for me.'),
  l('strawberry', 'soft', "{voice=strawberry}I caught you because you were falling. I didn't care who was winning.{/voice}"),
  l('strawberry', 'sad', "{voice=strawberry}Then the screen went dark. You went home. I didn't know how to say it.{/voice}"),
  l('coach', 'soft', 'I wrote you a letter. It said "Dear Straw." That\'s as far as I got.'),
  l('raspberry', 'smug', 'We know. We found it.', 'flag:sawLetter'),
  l('coach', 'shocked', 'You went in my {big}DRAWER?{/big}', 'flag:sawLetter'),
  l('strawberry', 'soft', '"Dear Straw" is further than I got.'),
  l('coach', 'neutral', 'I told them the muffins won. For eight years.'),
  l('strawberry', 'happy', 'The muffins were always yours. You brought a tray to every final.'),
  l('coach', 'soft', "Keep the trophy, Straw. I'd rather have the friend back."),
  l('strawberry', 'soft', '{voice=strawberry}Same seat on the 6:15?{/voice}'),
  l('coach', 'happy', 'Same seat.'),
];

// ---------------------------------------------------------------------------
// 7.6 Champions
// ---------------------------------------------------------------------------

export const CHAMPIONS: readonly CutLine[] = [
  l('orange', 'bold', '{big}LADIES AND GENTLEFRUITS!{/big} Eight years late, the result of the old final: {big}CRANBERRY!{/big}'),
  l('orange', 'bold', "And tonight's Grand Dance champions: {big}THE HOODIE'S CREW!{/big}"),
  l('orange', 'bold', 'The Trio Turn! All five of them! Maths is dead!', 'flag:crewName=trio'),
  l('orange', 'bold', "The Muffins! Coach, you've been avenged!", 'flag:crewName=muffins'),
];
export const HIGH_TOPS: readonly CutLine[] = [
  l('berry', 'neutral', 'A pair needs two.'),
  l('blueberry', 'shocked', "{pause} You're giving away half the trophy."),
  l('berry', 'happy', "I'm keeping half a friend. It's a good deal."),
];
export const TOP_SHELF: readonly CutLine[] = [
  l('grape', 'happy', 'We lost! (We lost!) And it was {wave}lovely!{/wave} (Is that allowed?) (It\'s allowed!)'),
  l('pineapple', 'neutral', "{slow}The plaque will need a name. Two plaques. I'll have them done correctly.{/slow}"),
  l('dragonfruit', 'soft', "{sparkle}Crews hold you up, darling.{/sparkle} I'm getting it embroidered."),
  l('coconut', 'neutral', 'Captain laughed. First time. Good.'),
];
export const GRAPE_COUNTS: readonly CutLine[] = [
  l('grape', 'shocked', 'He said {big}FIVE!{/big} (Five words!) (Count them!) (I counted twice!)'),
  l('coconut', 'neutral', '{pause} Hm.'),
];
export const CREW_LINES: readonly CutLine[] = [
  l('pear', 'happy', '{slow}We finished, man.{/slow} {fast}We FINISHED!{/fast}'),
  l('lemon', 'soft', "I didn't record it. Any of it. I remember all of it. Is this what it's like for everyone?"),
  l('watermelon', 'bold', "{big}EVERYONE TO MINE!{/big} No, wait. Everyone host me. I'm very round and very hungry."),
  l('raspberry', 'bold', 'Group hug. Not optional.'),
];
export const HUG_AFTER: readonly CutLine[] = [
  l('coach', 'happy', 'You took the first muffin, kid. I knew then.', 'flag:tookMuffin'),
  l('coach', 'happy', "Beats are like dough, kid. Told you they'd rise."),
  l('berry', 'happy', 'Same garden, next summer?'),
  l('blueberry', 'happy', 'Same garden. Bring the muffins.'),
];

// ---------------------------------------------------------------------------
// 7.7 The train home
// ---------------------------------------------------------------------------

export const TRAIN_HOME: readonly CutLine[] = [
  l('blueberry', 'soft', '{act}stops at the bench by the window{/act} I saved you a seat.'),
  l('berry', 'happy', '{act}sits{/act} Thanks.'),
  l('raspberry', 'smug', 'He\'s going to say "thanks" for the rest of his life now. Every single time.'),
  l('berry', 'happy', 'Thanks.'),
  l('banana', 'bold', "Tickets, please! First day as Conductor! I've been training for this my whole life!"),
  l('strawberry', 'smug', "You've been training for three hours."),
  l('banana', 'happy', 'My whole life, in hours! {pause} Tickets! {wave}Whoa!{/wave}'),
];

// ---------------------------------------------------------------------------
// 8.1 Credits: "Where they are now"
// ---------------------------------------------------------------------------

export interface CreditCard {
  /** Who the card is for (a speaker id, or two for Coach and Strawberry). */
  who: string[];
  title: string;
  /** What the still shows (the stand-in draws a hint of it). */
  still: string;
  line: string;
  /** Generated still, when it lands: public/assets/img/<key>.png. */
  art: string;
}

export const CREDIT_CARDS: readonly CreditCard[] = [
  { who: ['raspberry'], title: 'Raspberry', still: 'Behind the bakery counter, a framed Bog Queen poster', line: 'Promoted to assistant coach. Asks Coach "who won" every week anyway. Coach says "me".', art: 'credits_raspberry' },
  { who: ['pear'], title: 'Pear', still: 'A new mural, finished and signed', line: 'Finished three murals. Started forty. Progress.', art: 'credits_pear' },
  { who: ['lemon'], title: 'Dr. Lemon', still: 'A sunset, no camera, a lemon-shaped notebook', line: 'Writes down how things felt instead. The data is beautiful.', art: 'credits_lemon' },
  { who: ['watermelon'], title: 'Watermelon', still: 'His own table on the Rooftop, the crew serving him', line: 'Got hosted. Cried into the noodles. Five stars.', art: 'credits_watermelon' },
  { who: ['blueberry'], title: 'Blueberry', still: 'Teaching tiny kids the Trio Turn', line: 'Moved back to Berry Town at weekends. Falls on the drop less. Gets caught every time.', art: 'credits_blueberry' },
  { who: ['coach', 'strawberry'], title: 'Coach and Strawberry', still: 'The 6:15 window seat, two cups of tea', line: 'Same seat. Every Saturday.', art: 'credits_coach_strawberry' },
  { who: ['banana'], title: 'Banana', still: "In the Conductor's cap, mid-slip", line: 'Conductor. Has slipped in every carriage. The file is very thick.', art: 'credits_banana' },
  { who: ['grapefruit'], title: 'Grapefruit', still: 'In the lab, eating a whole crisp', line: 'Runs Citrus Labs. Pays herself in whole crisps.', art: 'credits_grapefruit' },
  { who: ['grape'], title: 'Grape', still: 'The bunch with Seedless on top', line: 'Now take a register at lunch. Seedless is always first.', art: 'credits_grape' },
  { who: ['coconut'], title: 'Coconut', still: 'On a bench with Watermelon', line: 'Says up to six words now. On special occasions.', art: 'credits_coconut' },
  { who: ['dragonfruit'], title: 'Dragon Fruit', still: 'The Club, the "SOLOISTS ONLY" sign crossed out', line: 'New club rule: bring your friends. Business has doubled.', art: 'credits_dragonfruit' },
  { who: ['pineapple'], title: 'Pineapple', still: 'The wall of champions, two new plaques', line: 'Wrote rule eighteen: catch people. Underlined it.', art: 'credits_pineapple' },
  { who: ['orange'], title: 'Orange', still: 'The booth, the red switch in a glass case', line: 'Called the old final on air, eight years late. Took forty minutes.', art: 'credits_orange' },
  { who: ['plum'], title: 'Plum', still: 'The tea house, two cups, both steaming', line: 'Two teas again.', art: 'credits_plum' },
  { who: ['lychee'], title: 'Lychee', still: '', line: '(see after the credits)', art: 'credits_lychee' },
];

/** The name cards between the postcards. */
export const CREDIT_NAMES: readonly [string, string[]][] = [
  ['Berry Beats', []],
  ['Story', ['The Berry Beats team']],
  ['Music', ['Nicole Yazmin', 'Story music: Berry Beats (generated)']],
  ['Art', ['Maxim Volk', 'Salvatore', 'Sainttufa']],
  ['Glacier35 font', ['Hugo4IT']],
  ['Made by', ['The contributors to Berry Beats']],
  ['Thank you for dancing', []],
];

// ---------------------------------------------------------------------------
// 8.2 Epilogue: "Next summer"
// ---------------------------------------------------------------------------

export const EPILOGUE_ARRIVALS: readonly CutLine[] = [
  l('mrsDamson', 'happy', "Dancing in the garden again. Noisy beans. All of you. I'm thrilled."),
  l('currant', 'smug', "I told my brother you're not a ghost. He said prove it. So I brought him."),
  l('watermelon', 'happy', 'I brought a barbecue! The barbecue brought sausages! The sausages brought joy!'),
  l('orange', 'bold', 'And I brought the console! Doc, have you got them?'),
  l('lemon', 'bold', 'The eight frames! Orange had the console, I had the tape, together we had the ending!', 'rumours>=11'),
  l('lemon', 'soft', "I recovered them. And this time I'm going to watch them with everyone. Not alone.", 'rumours>=11'),
  l('lemon', 'neutral', "I've nearly recovered the eight frames. Nearly. Next summer!", 'rumours<11'),
];
export const EPILOGUE_REMATCH: readonly CutLine[] = [
  l('raspberry', 'bold', 'Right. Rematch. Bog Queen against the Summer Legend. For fun. In a garden.'),
  l('coach', 'smug', "My knee's forty. I'm not."),
  l('strawberry', 'smug', '{voice=strawberry}Try not to trip, Cran.{/voice}'),
  l('coach', 'bold', 'Save your breath, Straw.'),
];
export const EPILOGUE_WHO_WON: readonly CutLine[] = [l('currant', 'shocked', '{big}WHO WON?!{/big}'), l('berry', 'happy', 'Both.')];
export const EPILOGUE_MOVES: readonly CutLine[] = [
  l('coach', 'happy', "The Bog Queen stomp. Plant it, kid. Like you're stamping a puddle into next week."),
  l('strawberry', 'soft', "The summer catch. Spin, reach, hold. It's not a finisher. It's better."),
];

// ---------------------------------------------------------------------------
// 8.3 Post-credits
// ---------------------------------------------------------------------------

export const LANTERN_KID: readonly CutLine[] = [l('lychee', 'soft', '{small}...okay.{/small}')];
export const SNACK_TROLLEY: readonly CutLine[] = [l('banana', 'bold', 'Tickets, plea... {wave}WHOA!{/wave}')];
