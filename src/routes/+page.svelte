<svelte:head>
  <meta name="description" content="Welcome to the Marianopolis Programming Club!">
  <title>Marianopolis Programming Club</title>
</svelte:head>

<script>
  import CustomBtn from "../components/buttons/CustomBtn.svelte";
  import EventCarousel from "../components/events/EventCarousel.svelte";
  import SeeAlso from "../components/SeeAlso.svelte";

  const seeAlsoLinks = {
    "About the Programming Club": ["/about-us", "Learn more about the club"],
    "Workshop archive": ["/our-workshops", "Past workshop material"],
    "Club roadmap": ["/roadmap", "See the club roadmap"],
  };
</script>

<SeeAlso bg='light-blue' {seeAlsoLinks} topSpacing />

<div class="join-hero d-flex flex-column reg-container row-gap-3 align-items-center">
  <h3 class="text-center text-black">Workshops, seminars, and activities for programmers of all levels!</h3>
  <CustomBtn btnStyle="primary" expand={false} link="https://forms.gle/yJjj42ooRk9NeB5J6">Join the Programming Club!</CustomBtn>
</div>

<div class="events-hero px-sm-1 py-5 overflow-x-hidden relative">
  <h3 class="text-center fw-bold mb-4 text-black">Upcoming events</h3>
  <EventCarousel events={{'Join a club day': ['Feb 1, 2024', 'Come see us in the gym during AP to learn more about the club and to sign up!'], 
                          'MariHacks mentor, judge, volunteer, panelist registration opens': ['Feb 12, 2024 or earlier (TBC)', 'High school and CEGEP students: make sure to register for MariHacks, the official hackathon of Marianopolis College!'],
                          'MariHacks hacker registration opens': ['Feb 12, 2024', 'High school and CEGEP students: make sure to register for MariHacks, the official hackathon of Marianopolis College!'],
                          'Workshop: OOP': ['Feb 13, 2024 (TBC)', 'Now that we\'ve covered Python basics, we will be covering the object-oriented programming (OOP) paradigm!'],
                          'Workshop: Algorithms and Data Structures 1': ['Feb 20, 2024 (TBC)', 'Knowing OOP will now allow us to learn fundamental computer science and programming concepts: algorithms and data structures.'],
                          'Workshop: Algorithms and Data Structures 2': ['Feb 29, 2024 (TBC)', 'A continuation of last week\'s workshop on algorithms and data structures.'],
                          'MariHacks': ['Apr 5-6, 2024', 'The 7th edition of Marianopolis College\'s official annual hackathon! See the MariHacks website for more details.']}} />
</div>

<style>
.events-hero {
  background-color: #ddd;
}
</style>