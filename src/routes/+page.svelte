<svelte:head>
  <meta name="description" content="Welcome to the Marianopolis Programming Club!">
  <title>Marianopolis Programming Club</title>
</svelte:head>

<script>
  import Card from "../components/Card.svelte";
  import CardRow from "../components/CardRow.svelte";
  import CustomBtn from "../components/buttons/CustomBtn.svelte";
  import EventCarousel from "../components/events/EventCarousel.svelte";
</script>

<CardRow bg='light-blue'>
  <a href="/about-us" class="text-decoration-none link-card-wrap"><Card title="About the Programming Club" desc="Learn more about the club" arrow list='' subtitle='' links='' /></a>
  <a href="/our-workshops" class="text-decoration-none link-card-wrap"><Card title="Workshop archive" desc="Past workshop material" arrow list='' subtitle='' links='' /></a>
  <a href="/roadmap" class="text-decoration-none link-card-wrap"><Card title="Club roadmap" desc="See the club roadmap" arrow list='' subtitle='' links='' /></a>
</CardRow>

<div class="join-hero d-flex flex-column reg-container row-gap-3 align-items-center">
  <h3 class="text-center">Workshops, seminars, and activities for programmers of all levels!</h3>
  <CustomBtn btnStyle="primary" expand={false} link="https://forms.gle/yJjj42ooRk9NeB5J6">Join the Programming Club!</CustomBtn>
</div>

<div class="events-hero px-sm-1 py-5 overflow-x-hidden relative">
  <h3 class="text-center fw-bold mb-4">Upcoming events</h3>
  <EventCarousel events={{'Event 1': ['Jan 17, 2024', 'Event 1 short description'], 
                          'Event 2': ['Jan 24, 2024', 'Event 2 short description'],
                          'Event 3': ['Jan 31, 2024', 'Event 3 longer description to test layout and CSS']}} />
</div>

<style>
.events-hero {
  background-color: #ddd;
}
</style>