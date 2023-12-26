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
  <EventCarousel events={{'Event 1': ['Jan 17, 2024', 'Event 1 short description'], 
                          'Event 2': ['Jan 24, 2024', 'Event 2 short description'],
                          'Event 3': ['Jan 31, 2024', 'Event 3 longer description to test layout and CSS']}} />
</div>

<style>
.events-hero {
  background-color: #ddd;
}
</style>