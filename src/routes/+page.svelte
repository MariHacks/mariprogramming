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
  <EventCarousel events={{
    'Workshop: OOP 2': ['Feb 15 (TBC), 2024', 'A continuation of the first/previous workshop on object-oriented programming (OOP)!'],
    'Workshop: Algorithms and Data Structures 1': ['Feb 20, 2024', 'Knowing OOP will now allow us to learn fundamental computer science and programming concepts: algorithms and data structures.'],
    'Workshop: Web dev 1': ['Feb 22, 2024', 'Introduction to web development foundations: HTML, CSS and some basic JavaScript!'],
    'Workshop: Web dev 2': ['Feb 27, 2024', 'JavaScript is one of the most in-demand web dev languages — this workshop will delve deeper into JS, preparing you to learn advanced tools like React in the future.'],
    'Workshop: Algorithms and Data Structures 2': ['Feb 29 (TBC), 2024', 'A continuation of last week\'s workshop on algorithms and data structures.'],
    'MariHacks mentor, judge, volunteer, panelist registration closes': ['Mar 10, 2024', 'CEGEP and university students, computer science industry professionals and more: we\'d love to have you at MariHacks this year as a volunteer, judge, mentor and/or guest speaker! Sign up or see more details on the MariHacks website!'],
    'MariHacks hacker registration closes': ['Mar 10, 2024', 'High school and CEGEP students: make sure to register for MariHacks, the official hackathon of Marianopolis College!'],
    'Workshop: Web dev 3': ['Mar 19 (TBC), 2024', 'Now that we\'ve covered JavaScript, we will learn one of the most popular JavaScript web frameworks, created by Facebook: React.'],
    'MariHacks': ['Apr 5-6, 2024', 'The 7th edition of Marianopolis College\'s official annual hackathon! See the MariHacks website for more details.']}} />
</div>

<style>
.events-hero {
  background-color: #ddd;
}
</style>