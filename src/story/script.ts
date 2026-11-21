/*
 * Every line of the story, exactly as written in docs/STORY_BIBLE.md ("Final dialogue").
 * tests/story.test.ts checks this file against the bible line by line, so edit both together.
 *
 * Each stop has three battles (A, B and C, see BATTLES in stops.ts). Battle A opens with the
 * stop's first meeting; battle C, the stop's main song, ends with the stop's win lines.
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
    battles: [
      {
        intro: [
          { who: 'raspberry', mood: 'bold', text: "Found you. Three months in this room, Berry. Three months!" },
          { who: 'raspberry', mood: 'neutral', text: "Blueberry's top of Fruit City now. And you? You just vanished." },
          { who: 'berry', mood: 'neutral', text: "..." },
          { who: 'raspberry', mood: 'bold', text: "Fine. If you won't talk, dance. Win and I'll leave you alone." },
        ],
        win: [
          { who: 'raspberry', mood: 'bold', text: "Lucky. That was one. Best of three, and don't you dare sit down." },
        ],
        lose: [
          { who: 'raspberry', mood: 'neutral', text: "Three months off and it shows. Up. Again." },
        ],
      },
      {
        intro: [
          { who: 'coach', mood: 'neutral', text: "Mind the muffins, you two. That tray took me all morning." },
          { who: 'raspberry', mood: 'bold', text: "Round two. Try to keep up, Berry." },
        ],
        win: [
          { who: 'raspberry', mood: 'neutral', text: "Okay. Okay! You're warming up. I hate that." },
        ],
        lose: [
          { who: 'raspberry', mood: 'bold', text: "You're thinking again. Don't think. Again." },
        ],
      },
      {
        intro: [
          { who: 'raspberry', mood: 'bold', text: "Last round. Win this one and I really will leave you alone." },
          { who: 'berry', mood: 'neutral', text: "..." },
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
    ],
  },
  {
    stop: 2,
    station: [
      { who: 'npc', mood: 'neutral', text: "That's Blueberry on the poster. Champion three years running. Never misses.", role: "ATTENDANT" },
    ],
    battles: [
      {
        intro: [
          { who: 'banana', mood: 'bold', text: "Ticket check! Mind the floor, it's a little sli... WHOA!" },
          { who: 'banana', mood: 'neutral', text: "Hoodie! New in town? We have a no-slip policy. I just break it." },
          { who: 'raspberry', mood: 'neutral', text: "He's harmless. Mostly. Show him your feet, Berry." },
          { who: 'banana', mood: 'bold', text: "Beat me and I stamp your pass. Lose, and I slip anyway!" },
        ],
        win: [
          { who: 'banana', mood: 'bold', text: "Stamp... wait. My stamp slipped. Best of three!" },
        ],
        lose: [
          { who: 'banana', mood: 'neutral', text: "Ticket denied! Kidding. Mostly. Go again." },
        ],
      },
      {
        intro: [
          { who: 'banana', mood: 'bold', text: "Round two, out on the street! Mind the peel. It's mine." },
          { who: 'raspberry', mood: 'neutral', text: "He does this to everyone. Just dance, Berry." },
        ],
        win: [
          { who: 'banana', mood: 'bold', text: "Okay, okay! Three out of five!" },
          { who: 'raspberry', mood: 'bold', text: "No." },
          { who: 'banana', mood: 'neutral', text: "Best of three, then. That was always the plan. Honest." },
        ],
        lose: [
          { who: 'banana', mood: 'bold', text: "Slipped you up! That's the street for you. Again!" },
        ],
      },
      {
        intro: [
          { who: 'banana', mood: 'bold', text: "Last one, at my stand. Win and the stamp is yours. For real!" },
        ],
        win: [
          { who: 'banana', mood: 'bold', text: "Stamped! Smooth moves, hoodie. Smoother than my floors." },
          { who: 'raspberry', mood: 'bold', text: "See? Outside didn't bite. Next stop!" },
        ],
        lose: [
          { who: 'banana', mood: 'neutral', text: "Whoops! That one was my slip, honest. Go again." },
        ],
      },
    ],
  },
  {
    stop: 3,
    station: [
      { who: 'npc', mood: 'neutral', text: "Blueberry's crew painted that step-slide on the wall. Looks like yours.", role: "ARTIST" },
    ],
    battles: [
      {
        intro: [
          { who: 'pear', mood: 'neutral', text: "Chill... new face. Sit. The corner ain't going anywhere." },
          { who: 'pear', mood: 'bold', text: "I start slow. Always do. By the end, you'll be begging." },
          { who: 'raspberry', mood: 'neutral', text: "Be nice, Pear. He's a work in progress." },
          { who: 'pear', mood: 'bold', text: "Everyone is. Let's go." },
        ],
        win: [
          { who: 'pear', mood: 'neutral', text: "Not bad... for a warm-up. Stay in the circle, man." },
        ],
        lose: [
          { who: 'pear', mood: 'neutral', text: "Easy, bro. The circle's patient. Again." },
        ],
      },
      {
        intro: [
          { who: 'pear', mood: 'neutral', text: "Rule of the corner. I only dance with people who finish." },
          { who: 'raspberry', mood: 'neutral', text: "Says the guy with half a mural." },
          { who: 'pear', mood: 'bold', text: "Half a mural is still a mural. Go." },
        ],
        win: [
          { who: 'pear', mood: 'bold', text: "You finished. Huh. Respect." },
        ],
        lose: [
          { who: 'pear', mood: 'neutral', text: "You faded out, man. Finish it this time." },
        ],
      },
      {
        intro: [
          { who: 'pear', mood: 'bold', text: "Okay. Now I'm warmed up. Watch the back half." },
        ],
        win: [
          { who: 'pear', mood: 'bold', text: "Okay, okay! The hoodie's got heat. Count me in." },
          { who: 'raspberry', mood: 'bold', text: "That's three. We need five." },
        ],
        lose: [
          { who: 'pear', mood: 'neutral', text: "Slow start is my thing, bro. Not yours. Again." },
        ],
      },
    ],
  },
  {
    stop: 4,
    station: [
      { who: 'npc', mood: 'neutral', text: "Five dancers to enter the Grand Dance. You have three. Find two more.", role: "GUARD" },
    ],
    battles: [
      {
        intro: [
          { who: 'grape', mood: 'bold', text: "We guard the crossing! (...) Sorry. It's just me right now." },
          { who: 'grape', mood: 'neutral', text: "The others are on lunch. I'm usually more of us." },
          { who: 'raspberry', mood: 'neutral', text: "One grape. We can take one grape, Berry." },
        ],
        win: [
          { who: 'grape', mood: 'neutral', text: "I lost. (...) No echo. That's the worst part." },
        ],
        lose: [
          { who: 'grape', mood: 'bold', text: "I won! (...) Somebody say I won. Again!" },
        ],
      },
      {
        intro: [
          { who: 'grape', mood: 'bold', text: "We're back! (We're back!) Two of us now! (Two!)" },
          { who: 'pear', mood: 'neutral', text: "Man... they doubled." },
        ],
        win: [
          { who: 'grape', mood: 'neutral', text: "Two wasn't enough. (Not enough.) Get everyone! (Everyone!)" },
        ],
        lose: [
          { who: 'grape', mood: 'bold', text: "Two beats one! (Two!) Again! (Again!)" },
        ],
      },
      {
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
    ],
  },
  {
    stop: 5,
    station: [
      { who: 'npc', mood: 'neutral', text: "Dr. Lemon filmed the captain's crew forty-seven times. He's obsessed.", role: "ASSISTANT" },
    ],
    battles: [
      {
        intro: [
          { who: 'lemon', mood: 'bold', text: "EUREKA! A subject! Don't touch anything. Or anyone. Or me." },
          { who: 'lemon', mood: 'neutral', text: "I filmed a crew last week. Same step-slide as yours. Coincidence? No!" },
          { who: 'pear', mood: 'neutral', text: "Man... that's the third time someone's said that." },
          { who: 'lemon', mood: 'bold', text: "Hypothesis: you lose. Results pending!" },
        ],
        win: [
          { who: 'lemon', mood: 'bold', text: "Calibration complete! Your feet are twelve percent faster than predicted!" },
        ],
        lose: [
          { who: 'lemon', mood: 'neutral', text: "Calibration error. Probably you. Recalibrating!" },
        ],
      },
      {
        intro: [
          { who: 'lemon', mood: 'neutral', text: "Trial two. I've made it harder. Scientifically." },
          { who: 'lemon', mood: 'bold', text: "Streaks, then chaos! Try not to melt down. I always do." },
        ],
        win: [
          { who: 'lemon', mood: 'bold', text: "Fascinating! Hypothesis rejected! Again, with more chaos!" },
        ],
        lose: [
          { who: 'lemon', mood: 'neutral', text: "Data point recorded. A sad one. Go again." },
        ],
      },
      {
        intro: [
          { who: 'lemon', mood: 'bold', text: "Final trial! Full meltdown! Goggles on, everybody!" },
          { who: 'pear', mood: 'neutral', text: "We don't have goggles, man." },
        ],
        win: [
          { who: 'lemon', mood: 'bold', text: "EUREKA! The data is beautiful! May I join your crew? I have snacks." },
          { who: 'raspberry', mood: 'bold', text: "Four of us now. One more to go." },
        ],
        lose: [
          { who: 'lemon', mood: 'neutral', text: "Fascinating failure! Recording. Please go again." },
        ],
      },
    ],
  },
  {
    stop: 6,
    station: [
      { who: 'npc', mood: 'neutral', text: "Tea's free if you smile. Your friend in the hoodie hasn't yet.", role: "STALL KEEPER" },
    ],
    battles: [
      {
        intro: [
          { who: 'plum', mood: 'neutral', text: "The market is quiet tonight. Dance for the lanterns, young ones." },
          { who: 'plum', mood: 'neutral', text: "You dance like someone is missing. Who is it?" },
          { who: 'raspberry', mood: 'neutral', text: "Don't answer that, Berry. Just dance." },
        ],
        win: [
          { who: 'plum', mood: 'neutral', text: "One lantern lit. The market is waking up." },
        ],
        lose: [
          { who: 'plum', mood: 'neutral', text: "Too fast, young one. Lanterns light slowly." },
        ],
      },
      {
        intro: [
          { who: 'plum', mood: 'bold', text: "Best of three, young ones. Plum has time." },
          { who: 'lemon', mood: 'neutral', text: "She said that like a threat." },
        ],
        win: [
          { who: 'plum', mood: 'neutral', text: "Two lanterns. One more, and the whole street is bright." },
        ],
        lose: [
          { who: 'plum', mood: 'neutral', text: "Rest is part of the dance. Rest, then go again." },
        ],
      },
      {
        intro: [
          { who: 'plum', mood: 'bold', text: "The last lantern. Dance it slowly." },
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
    ],
  },
  {
    stop: 7,
    station: [
      { who: 'npc', mood: 'neutral', text: "No hoods on the main floor. The captain's rule.", role: "BOUNCER" },
    ],
    battles: [
      {
        intro: [
          { who: 'dragonfruit', mood: 'bold', text: "Behold! The Club! Where nobody hides. Hoodie, that's a problem." },
          { who: 'dragonfruit', mood: 'neutral', text: "Same footwork as the captain. You just wear it like an apology." },
          { who: 'raspberry', mood: 'neutral', text: "Berry, say something. Anything. Tell him he's wrong." },
          { who: 'berry', mood: 'neutral', text: "..." },
          { who: 'pear', mood: 'neutral', text: "Bro..." },
        ],
        win: [
          { who: 'dragonfruit', mood: 'bold', text: "A spark! Tiny, but hot. The floor is yours. Briefly." },
        ],
        lose: [
          { who: 'dragonfruit', mood: 'neutral', text: "Darling, the door stays shut for dim lights. Again." },
        ],
      },
      {
        intro: [
          { who: 'dragonfruit', mood: 'bold', text: "Club rule: the floor is for one. Your friends can watch." },
          { who: 'pear', mood: 'neutral', text: "Bro... we're right here." },
          { who: 'berry', mood: 'neutral', text: "..." },
        ],
        win: [
          { who: 'dragonfruit', mood: 'bold', text: "Ooh, he burns alone. Just like the captain." },
          { who: 'raspberry', mood: 'neutral', text: "Berry. Look at us. Say something." },
        ],
        lose: [
          { who: 'dragonfruit', mood: 'bold', text: "The spotlight dims! One more try, hoodie." },
        ],
      },
      {
        intro: [
          { who: 'dragonfruit', mood: 'bold', text: "The main floor! Full lights! Let's see you shine, hoodie." },
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
    ],
  },
  {
    stop: 8,
    station: [
      { who: 'npc', mood: 'neutral', text: "November nights end early. Stay till the lights come on.", role: "DJ" },
    ],
    battles: [
      {
        intro: [
          { who: 'watermelon', mood: 'bold', text: "WELCOME TO THE ROOFTOP! Hey, small hoodie! Where's your crew?" },
          { who: 'berry', mood: 'neutral', text: "..." },
          { who: 'watermelon', mood: 'neutral', text: "Table for one, then. Dance for your supper. Nice and slow." },
        ],
        win: [
          { who: 'watermelon', mood: 'bold', text: "Delicious! But you dance like you're waiting for someone." },
        ],
        lose: [
          { who: 'watermelon', mood: 'neutral', text: "Hold it longer, little one. Good things take time." },
        ],
      },
      {
        intro: [
          { who: 'watermelon', mood: 'neutral', text: "Big feelings need big words. Or big dancing. Try either." },
          { who: 'berry', mood: 'bold', text: "I'm bad at saying things. But I want my crew back." },
          { who: 'watermelon', mood: 'bold', text: "THAT'S IT! Now dance it out!" },
        ],
        win: [
          { who: 'watermelon', mood: 'bold', text: "Bigger! Louder! One more, and mean every beat!" },
        ],
        lose: [
          { who: 'watermelon', mood: 'neutral', text: "You said the hard part already. Dance the easy part. Again." },
        ],
      },
      {
        intro: [
          { who: 'watermelon', mood: 'bold', text: "Last dance of the night! Big heart, bigger beat!" },
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
    ],
  },
  {
    stop: 9,
    station: [
      { who: 'npc', mood: 'neutral', text: "Tunnel's closed. Captain's orders. Unless you can dance.", role: "WORKER" },
    ],
    battles: [
      {
        intro: [
          { who: 'coconut', mood: 'neutral', text: "Halt." },
          { who: 'raspberry', mood: 'bold', text: "We know, shell-head. Let us through." },
        ],
        win: [
          { who: 'coconut', mood: 'neutral', text: "Gate one. Pass." },
        ],
        lose: [
          { who: 'coconut', mood: 'neutral', text: "No." },
        ],
      },
      {
        intro: [
          { who: 'coconut', mood: 'neutral', text: "Captain's step." },
          { who: 'pear', mood: 'neutral', text: "Man, he really doesn't do small talk." },
        ],
        win: [
          { who: 'coconut', mood: 'neutral', text: "Again. Further." },
        ],
        lose: [
          { who: 'coconut', mood: 'neutral', text: "Not passing. Not yet." },
        ],
      },
      {
        intro: [
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
    ],
  },
  {
    stop: 10,
    station: [
      { who: 'npc', mood: 'neutral', text: "Hot cider! Warm up before the Grand Stage. It's freezing out there.", role: "VENDOR" },
    ],
    battles: [
      {
        intro: [
          { who: 'orange', mood: 'bold', text: "LADIES AND GENTLEFRUITS! Welcome to the Grand Dance!" },
          { who: 'orange', mood: 'bold', text: "Fresh-squeezed talent! A crew of five? We love to see it!" },
          { who: 'orange', mood: 'neutral', text: "Mic check! The hoodie's on! Folks, we want a face!" },
          { who: 'raspberry', mood: 'neutral', text: "You don't have to, Berry." },
          { who: 'berry', mood: 'bold', text: "Not yet. After." },
          { who: 'orange', mood: 'bold', text: "First qualifier! All the way from Peel Street, it's Banana!" },
          { who: 'banana', mood: 'bold', text: "Remember me? Best of three, part four!" },
        ],
        win: [
          { who: 'banana', mood: 'neutral', text: "Slipped again. Good luck up there, hoodie!" },
        ],
        lose: [
          { who: 'orange', mood: 'bold', text: "Banana takes it! Slippery! Reset, folks!" },
        ],
      },
      {
        intro: [
          { who: 'orange', mood: 'bold', text: "Second qualifier! From the Lantern Market, give it up for Plum!" },
          { who: 'plum', mood: 'neutral', text: "You stand differently now, young one. Show me." },
        ],
        win: [
          { who: 'plum', mood: 'neutral', text: "Ripe at last. Go on. The big stage is waiting." },
        ],
        lose: [
          { who: 'plum', mood: 'neutral', text: "Breathe first. The music will wait for you." },
        ],
      },
      {
        intro: [
          { who: 'orange', mood: 'bold', text: "And now, the exhibition! Me! Hold your applause. Actually, don't!" },
        ],
        win: [
          { who: 'orange', mood: 'bold', text: "Mic drop! The hood stays up, folks. The crowd's not thrilled!" },
          { who: 'raspberry', mood: 'bold', text: "Almost there. Blueberry's waiting at the end of the Line." },
        ],
        lose: [
          { who: 'orange', mood: 'neutral', text: "Cue the buzzer! Reset! Quick intro, longer outro!" },
        ],
      },
    ],
  },
  {
    stop: 11,
    station: [
      { who: 'npc', mood: 'neutral', text: "The captain rehearses alone every night. Nobody knows why.", role: "USHER" },
    ],
    battles: [
      {
        intro: [
          { who: 'pineapple', mood: 'neutral', text: "Mind the spikes. They mind you." },
          { who: 'pineapple', mood: 'bold', text: "You dance like the captain. Except he doesn't hide." },
          { who: 'pineapple', mood: 'neutral', text: "He mentions a hoodie who never answered him. Is that you?" },
          { who: 'raspberry', mood: 'bold', text: "He asked about Berry?" },
          { who: 'pineapple', mood: 'neutral', text: "Never by name. Always the hoodie." },
          { who: 'berry', mood: 'neutral', text: "..." },
        ],
        win: [
          { who: 'pineapple', mood: 'bold', text: "Cute step. Sharper next time." },
        ],
        lose: [
          { who: 'pineapple', mood: 'neutral', text: "Sloppy. In this hall, every miss counts twice." },
        ],
      },
      {
        intro: [
          { who: 'pineapple', mood: 'neutral', text: "The rehearsal room. Mirrors on every wall. He dances here alone." },
          { who: 'raspberry', mood: 'neutral', text: "Every night? By himself?" },
          { who: 'pineapple', mood: 'bold', text: "Dance. The mirrors don't lie. I do, sometimes." },
        ],
        win: [
          { who: 'pineapple', mood: 'neutral', text: "Hm. You looked at yourself and didn't look away." },
        ],
        lose: [
          { who: 'pineapple', mood: 'bold', text: "The mirror saw that. So did I. Again." },
        ],
      },
      {
        intro: [
          { who: 'pineapple', mood: 'bold', text: "Main hall. No mirrors, no hood tricks. Just correct." },
        ],
        win: [
          { who: 'pineapple', mood: 'neutral', text: "Spiky, but fair. Go on. He's practiced that step all week." },
        ],
        lose: [
          { who: 'pineapple', mood: 'bold', text: "Ouch? That's what spikes are for. Again." },
        ],
      },
    ],
  },
  {
    stop: 12,
    station: [
      { who: 'npc', mood: 'neutral', text: "Fifteen minutes. The captain asked if a hoodie signed up.", role: "STAGEHAND" },
    ],
    battles: [
      {
        intro: [
          { who: 'orange', mood: 'bold', text: "FIVE against FIVE! Fruit City, make some noise!" },
          { who: 'blueberry', mood: 'bold', text: "Look who finally came out of his room." },
          { who: 'blueberry', mood: 'neutral', text: "Five against five. I carry my crew. You'd carry yours. Try." },
          { who: 'raspberry', mood: 'bold', text: "Stop showing off, Blueberry. We missed you." },
          { who: 'blueberry', mood: 'neutral', text: "I don't miss anyone. I miss audiences." },
        ],
        win: [
          { who: 'orange', mood: 'bold', text: "Set one to the hoodie's crew! Fruit City, are you awake?" },
        ],
        lose: [
          { who: 'blueberry', mood: 'neutral', text: "One set down, hoodie. My crew's only warming up." },
        ],
      },
      {
        intro: [
          { who: 'blueberry', mood: 'bold', text: "Set two. Pineapple and the dragon. Good luck with that." },
        ],
        win: [
          { who: 'blueberry', mood: 'neutral', text: "...Okay. Two sets. Fine. It's just us now." },
        ],
        lose: [
          { who: 'orange', mood: 'bold', text: "Set two to the champion's crew! Reset and go again!" },
        ],
      },
      {
        intro: [
          { who: 'orange', mood: 'bold', text: "The final set! The hoodie against the champion! Double points!" },
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
      },
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
