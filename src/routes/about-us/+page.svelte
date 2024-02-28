<svelte:head>
  <meta name="description" content="Programming resources recommended by our club execs">
  <title>About us | Programming Club</title>
</svelte:head>

<script>
  import SeeAlso from '../../components/SeeAlso.svelte';

  const seeAlsoLinks = {
    "Sign up for MariHacks!": ["https://www.marihacks.com", "Deadline is March 10, 11:59 pm EST"],
    // "Sign up now!": ["https://forms.gle/yJjj42ooRk9NeB5J6", "Join our Discord too :)"],
    "Workshop archive": ["/our-workshops", "Past workshop material"],
    "Club roadmap": ["/roadmap", "See the club roadmap"],
  }
</script>

<div class="reg-container">
  <h2 class="text-black heading">About us</h2>
  <p class="text-black text-body">Whether you're a beginner or expert, the Programming Club is the perfect place to start (or continue) your coding journey! 
    Discover the joy of programming with our community through a multitude of activities.</p>

  <div class="text-black about-us pt-3 d-flex flex-column flex-lg-row gap-4 gap-lg-5 align-items-start">
    <img class="desc-img" src="/club-preview-1.svg" alt="Preview of club activities such as workshops, lessons, guest speakers, MariHacks, bake sale and more">
    <div class="desc text-black">
      <p>What the Programming Club offers:</p>
      <ul class="d-flex flex-column">
        <li>Workshops on many topics: Python, algorithms, web development and more (no experience required!)</li>
        <li>Seminars by guest speakers such as university professors and industry professionals</li>
        <li>Other fun coding events including MariHacks!</li>
      </ul>
    </div>
  </div>
</div>

<SeeAlso bg='light-gray' {seeAlsoLinks} topSpacing />

<style>
.desc {
  font-size: 1.25rem;
}

.desc p {
  margin-bottom: 1.25rem;
}

.desc ul {
  gap: 0.75rem;
}

.desc-img {
  width: 100%;
}

@media screen and (min-width: 992px) {
  .desc-img {
    width: 50%;
  }
}

@media screen and (min-width: 1200px) {
  .desc-img {
    width: 40%;
  }
}

@media screen and (min-width: 1440px) {
  .desc-img {
    width: 35%;
  }
}
</style>