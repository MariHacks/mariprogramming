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
  <CustomBtn btnStyle="primary" expand={true} link="https://www.marihacks.com">Club registration is closed for W24, but make sure to sign up for MariHacks!</CustomBtn>
</div>

<div class="events-hero px-sm-1 py-5 overflow-x-hidden relative">
  <h3 class="text-center fw-bold mb-4 text-black">Upcoming events</h3>
  <EventCarousel events={{
    'Problem-solving session: CCC prep and more': ['Feb 20, 2024 in D-111', 'Review and prepare for the upcoming Canadian Computing Competition! Bring your own coding problems or try your hand at the ones we\'ve prepared, and come get some candies too :)'],
    'Workshop: Web dev 1': ['Feb 22, 2024 in D-111', 'Introduction to web development foundations: HTML, CSS and some basic JavaScript!'],
    'Workshop: Web dev 2': ['Feb 27, 2024 in D-111', 'JavaScript is one of the most in-demand web dev languages — this workshop will delve deeper into JS, preparing you to learn advanced tools like React in the future.'],
    'Workshop: TBD': ['Feb 29, 2024', 'Project-based workshop, exact topic TBD.'],
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