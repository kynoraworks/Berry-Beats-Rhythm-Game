/*
 * Every line of the story, exactly as written in docs/STORY_BIBLE.md ("Final dialogue").
 * tests/story.test.ts checks this file against the bible line by line, so edit both together.
 */
import type { StopScript } from './types';

export const SCRIPT: readonly StopScript[] = [
  {
    stop: 1,
    station: [
      { who: 'npc', mood: 'neutral', text: "Haven't seen you since July, Berry. The garden's overgrown.", role: "NEIGHBOR" },
    ],
    tutorial: [
      { who: 'coach', mood: 'neutral', text: "Brought muffins. You didn't answer the door, so I used the window." },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'coach', mood: 'bold', text: "Four arrows, four lanes. Hit each one as it lands on the line." },
      { who: 'coach', mood: 'neutral', text: "Count with me. One, two, three, four. Feel that? That's the beat." },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'coach', mood: 'bold', text: "Good. Now keep it going. Don't think. Just move." },
      { who: 'coach', mood: 'neutral', text: "There. Beats are like dough, kid. They just need time." },
    ],
    intro: [
      { who: 'raspberry', mood: 'bold', text: "Found you. Three months in this room, Berry. Three months!" },
      { who: 'raspberry', mood: 'neutral', text: "Blueberry's top of Fruit City now. And you? You just vanished." },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'raspberry', mood: 'bold', text: "Fine. If you won't talk, dance. Win and I'll leave you alone." },
    ],
    win: [
      { who: 'raspberry', mood: 'neutral', text: "Still got it. Of course you do. That's the annoying part." },
      { who: 'coach', mood: 'bold', text: "A ticket to the Grand Dance in Fruit City. Last stop on the Line." },
      { who: 'raspberry', mood: 'bold', text: "I said I'd leave you alone. I lied. We need to get you outside." },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'raspberry', mood: 'bold', text: "Pack a coat. It's November, and I'm coming with you." },
    ],
    lose: [
      { who: 'raspberry', mood: 'neutral', text: "Nope. You're not hiding behind a loss. Again." },
    ],
  },
  {
    stop: 2,
    station: [
      { who: 'npc', mood: 'neutral', text: "That's Blueberry on the poster. Champion three years running. Never misses.", role: "ATTENDANT" },
    ],
    intro: [
      { who: 'banana', mood: 'bold', text: "Ticket check! Mind the floor, it's a little sli... WHOA!" },
      { who: 'banana', mood: 'neutral', text: "Hoodie! New in town? We have a no-slip policy. I just break it." },
      { who: 'raspberry', mood: 'neutral', text: "He's harmless. Mostly. Show him your feet, Berry." },
      { who: 'banana', mood: 'bold', text: "Beat me and I stamp your pass. Lose, and I slip anyway!" },
    ],
    win: [
      { who: 'banana', mood: 'bold', text: "Stamped! Smooth moves, hoodie. Smoother than my floors." },
      { who: 'raspberry', mood: 'bold', text: "See? Outside didn't bite. Next stop!" },
    ],
    lose: [
      { who: 'banana', mood: 'neutral', text: "Whoops! That one was my slip, honest. Go again." },
    ],
  },
  {
    stop: 3,
    station: [
      { who: 'npc', mood: 'neutral', text: "Blueberry's crew painted that step-slide on the wall. Looks like yours.", role: "ARTIST" },
    ],
    intro: [
      { who: 'pear', mood: 'neutral', text: "Chill... new face. Sit. The corner ain't going anywhere." },
      { who: 'pear', mood: 'bold', text: "I start slow. Always do. By the end, you'll be begging." },
      { who: 'raspberry', mood: 'neutral', text: "Be nice, Pear. He's a work in progress." },
      { who: 'pear', mood: 'bold', text: "Everyone is. Let's go." },
    ],
    win: [
      { who: 'pear', mood: 'bold', text: "Okay, okay! The hoodie's got heat. Count me in." },
      { who: 'raspberry', mood: 'bold', text: "That's three. We need five." },
    ],
    lose: [
      { who: 'pear', mood: 'neutral', text: "Slow start is my thing, bro. Not yours. Again." },
    ],
  },
  {
    stop: 4,
    station: [
      { who: 'npc', mood: 'neutral', text: "Five dancers to enter the Grand Dance. You have three. Find two more.", role: "GUARD" },
    ],
    intro: [
      { who: 'grape', mood: 'bold', text: "We are Grape! (We are Grape!) We guard the crossing! (We guard it!)" },
      { who: 'grape', mood: 'neutral', text: "Ooh. That step-slide. Where did you learn it? (Where?)" },
      { who: 'grape', mood: 'neutral', text: "Our captain does it. Exactly like that. (Exactly!)" },
      { who: 'raspberry', mood: 'neutral', text: "Coincidence. Fruit City loves a step-slide." },
      { who: 'berry', mood: 'neutral', text: "..." },
    ],
    win: [
      { who: 'grape', mood: 'neutral', text: "We lost. (We lost.) We're not sure how. (Not sure.)" },
      { who: 'grape', mood: 'bold', text: "Go on through! (Go on!) The captain won't be this nice. (He won't!)" },
    ],
    lose: [
      { who: 'grape', mood: 'bold', text: "Out of sync, hoodie! (Out of sync!) Again! (Again!)" },
    ],
  },
  {
    stop: 5,
    station: [
      { who: 'npc', mood: 'neutral', text: "Dr. Lemon filmed the captain's crew forty-seven times. He's obsessed.", role: "ASSISTANT" },
    ],
    intro: [
      { who: 'lemon', mood: 'bold', text: "EUREKA! A subject! Don't touch anything. Or anyone. Or me." },
      { who: 'lemon', mood: 'neutral', text: "I filmed a crew last week. Same step-slide as yours. Coincidence? No!" },
      { who: 'pear', mood: 'neutral', text: "Man... that's the third time someone's said that." },
      { who: 'lemon', mood: 'bold', text: "Hypothesis: you lose. Results pending!" },
    ],
    win: [
      { who: 'lemon', mood: 'bold', text: "EUREKA! The data is beautiful! May I join your crew? I have snacks." },
      { who: 'raspberry', mood: 'bold', text: "Four of us now. One more to go." },
    ],
    lose: [
      { who: 'lemon', mood: 'neutral', text: "Fascinating failure! Recording. Please go again." },
    ],
  },
  {
    stop: 6,
    station: [
      { who: 'npc', mood: 'neutral', text: "Tea's free if you smile. Your friend in the hoodie hasn't yet.", role: "STALL KEEPER" },
    ],
    intro: [
      { who: 'plum', mood: 'neutral', text: "The market is quiet tonight. Dance for the lanterns, young ones." },
      { who: 'plum', mood: 'neutral', text: "You dance like someone is missing. Who is it?" },
      { who: 'raspberry', mood: 'neutral', text: "Don't answer that, Berry. Just dance." },
    ],
    win: [
      { who: 'plum', mood: 'bold', text: "Lovely. Remember, rest between notes is also a note." },
      { who: 'pear', mood: 'bold', text: "Best night ever, hoodie!" },
      { who: 'lemon', mood: 'bold', text: "Statistically, yes!" },
      { who: 'plum', mood: 'neutral', text: "A fruit in a dragon scarf watched all night. Taking notes." },
    ],
    lose: [
      { who: 'plum', mood: 'neutral', text: "Patience, young one. Breathe. Then begin again." },
    ],
  },
  {
    stop: 7,
    station: [
      { who: 'npc', mood: 'neutral', text: "No hoods on the main floor. The captain's rule.", role: "BOUNCER" },
    ],
    intro: [
      { who: 'dragonfruit', mood: 'bold', text: "Behold! The Club! Where nobody hides. Hoodie, that's a problem." },
      { who: 'dragonfruit', mood: 'neutral', text: "Same footwork as the captain. You just wear it like an apology." },
      { who: 'raspberry', mood: 'neutral', text: "Berry, say something. Anything. Tell him he's wrong." },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'pear', mood: 'neutral', text: "Bro..." },
    ],
    win: [
      { who: 'dragonfruit', mood: 'neutral', text: "Flawless. Cold. Exactly like him. Welcome to the top." },
      { who: 'lemon', mood: 'neutral', text: "Berry, that was perfect. And I felt nothing. Why?" },
      { who: 'pear', mood: 'neutral', text: "Nobody in this crew knows what you're thinking, man." },
      { who: 'raspberry', mood: 'neutral', text: "Three months of nothing. Just say something, Berry." },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'raspberry', mood: 'neutral', text: "I can't dance with a wall. I'm sorry." },
    ],
    lose: [
      { who: 'dragonfruit', mood: 'bold', text: "Dim the lights, hoodie. You're not shining yet." },
    ],
  },
  {
    stop: 8,
    station: [
      { who: 'npc', mood: 'neutral', text: "November nights end early. Stay till the lights come on.", role: "DJ" },
    ],
    intro: [
      { who: 'watermelon', mood: 'bold', text: "WELCOME TO THE ROOFTOP! Hey, small hoodie! Where's your crew?" },
      { who: 'berry', mood: 'neutral', text: "..." },
      { who: 'watermelon', mood: 'neutral', text: "Big feelings need big words. Or big dancing. Try either." },
      { who: 'berry', mood: 'bold', text: "I'm bad at saying things. But I want my crew back." },
      { who: 'watermelon', mood: 'bold', text: "THAT'S IT! Now dance it out!" },
    ],
    win: [
      { who: 'watermelon', mood: 'bold', text: "Beautiful! I'm joining you. Big heart, bigger beat!" },
      { who: 'raspberry', mood: 'neutral', text: "We heard. All of it. Move over, hoodie." },
      { who: 'pear', mood: 'neutral', text: "Crew's back." },
      { who: 'berry', mood: 'bold', text: "Blueberry asked me to come to Fruit City. I just stood there." },
      { who: 'raspberry', mood: 'neutral', text: "I know. I was there. I should've said something too." },
      { who: 'lemon', mood: 'bold', text: "Five dancers! Mathematically, we qualify!" },
    ],
    lose: [
      { who: 'watermelon', mood: 'neutral', text: "Take a breath, little one. I'm patient. And very round." },
    ],
  },
  {
    stop: 9,
    station: [
      { who: 'npc', mood: 'neutral', text: "Tunnel's closed. Captain's orders. Unless you can dance.", role: "WORKER" },
    ],
    intro: [
      { who: 'coconut', mood: 'neutral', text: "Halt." },
      { who: 'coconut', mood: 'neutral', text: "Captain's step." },
      { who: 'raspberry', mood: 'bold', text: "We know, shell-head. Let us through." },
      { who: 'coconut', mood: 'neutral', text: "Dance. Then pass." },
    ],
    win: [
      { who: 'coconut', mood: 'neutral', text: "Pass." },
      { who: 'coconut', mood: 'bold', text: "Captain doesn't laugh anymore." },
      { who: 'raspberry', mood: 'neutral', text: "He used to laugh at everything. Remember?" },
      { who: 'berry', mood: 'neutral', text: "..." },
    ],
    lose: [
      { who: 'coconut', mood: 'neutral', text: "No. Again." },
    ],
  },
  {
    stop: 10,
    station: [
      { who: 'npc', mood: 'neutral', text: "Hot cider! Warm up before the Grand Stage. It's freezing out there.", role: "VENDOR" },
    ],
    intro: [
      { who: 'orange', mood: 'bold', text: "LADIES AND GENTLEFRUITS! Welcome to the Grand Dance!" },
      { who: 'orange', mood: 'bold', text: "Fresh-squeezed talent! A crew of five? We love to see it!" },
      { who: 'orange', mood: 'neutral', text: "Mic check! The hoodie's on! Folks, we want a face!" },
      { who: 'raspberry', mood: 'neutral', text: "You don't have to, Berry." },
      { who: 'berry', mood: 'bold', text: "Not yet. After." },
    ],
    win: [
      { who: 'orange', mood: 'bold', text: "Mic drop! The hood stays up, folks. The crowd's not thrilled!" },
      { who: 'raspberry', mood: 'bold', text: "Almost there. Blueberry's waiting at the end of the Line." },
    ],
    lose: [
      { who: 'orange', mood: 'neutral', text: "Cue the buzzer! Reset! Quick intro, longer outro!" },
    ],
  },
  {
    stop: 11,
    station: [
      { who: 'npc', mood: 'neutral', text: "The captain rehearses alone every night. Nobody knows why.", role: "USHER" },
    ],
    intro: [
      { who: 'pineapple', mood: 'neutral', text: "Mind the spikes. They mind you." },
      { who: 'pineapple', mood: 'bold', text: "You dance like the captain. Except he doesn't hide." },
      { who: 'pineapple', mood: 'neutral', text: "He mentions a hoodie who never answered him. Is that you?" },
      { who: 'raspberry', mood: 'bold', text: "He asked about Berry?" },
      { who: 'pineapple', mood: 'neutral', text: "Never by name. Always the hoodie." },
      { who: 'berry', mood: 'neutral', text: "..." },
    ],
    win: [
      { who: 'pineapple', mood: 'neutral', text: "Spiky, but fair. Go on. He's practiced that step all week." },
    ],
    lose: [
      { who: 'pineapple', mood: 'bold', text: "Ouch? That's what spikes are for. Again." },
    ],
  },
  {
    stop: 12,
    station: [
      { who: 'npc', mood: 'neutral', text: "Fifteen minutes. The captain asked if a hoodie signed up.", role: "STAGEHAND" },
    ],
    intro: [
      { who: 'orange', mood: 'bold', text: "FIVE against FIVE! Fruit City, make some noise!" },
      { who: 'blueberry', mood: 'bold', text: "Look who finally came out of his room." },
      { who: 'blueberry', mood: 'neutral', text: "Five against five. I carry my crew. You'd carry yours. Try." },
      { who: 'raspberry', mood: 'bold', text: "Stop showing off, Blueberry. We missed you." },
      { who: 'blueberry', mood: 'neutral', text: "I don't miss anyone. I miss audiences." },
    ],
    win: [
      { who: 'blueberry', mood: 'neutral', text: "...You didn't hide. Not once." },
      { who: 'berry', mood: 'bold', text: "I should have said yes. I'm saying it now. Yes." },
      { who: 'blueberry', mood: 'neutral', text: "You were supposed to say that in July." },
      { who: 'blueberry', mood: 'bold', text: "The step-slide. I never stopped dancing it. It's yours too." },
      { who: 'raspberry', mood: 'bold', text: "Group hug. Not optional." },
      { who: 'berry', mood: 'bold', text: "Same garden, next summer?" },
      { who: 'blueberry', mood: 'bold', text: "Same garden. Bring the muffins." },
      { who: 'coach', mood: 'bold', text: "Beats are like dough, kid. Told you they'd rise." },
    ],
    lose: [
      { who: 'blueberry', mood: 'bold', text: "Say something, hoodie. Anything. No? Again." },
    ],
    rounds: [
      { who: 'grape', mood: 'bold', text: "Captain, we've got this! (We've got this!)" },
      { who: 'coconut', mood: 'neutral', text: "Not passing." },
      { who: 'pineapple', mood: 'bold', text: "Sharper than last time, hoodie." },
      { who: 'dragonfruit', mood: 'bold', text: "The dragon never loses!" },
      { who: 'blueberry', mood: 'neutral', text: "Last round. Just us. Like old times." },
      { who: 'berry', mood: 'neutral', text: "..." },
    ],
  },
];
