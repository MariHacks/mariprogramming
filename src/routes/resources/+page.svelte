<svelte:head>
  <meta name="description" content="Programming resources recommended by our club execs">
  <title>Resources | Programming Club</title>
</svelte:head>

<script>
  import ResourceCard from '../../components/ResourceCard.svelte';
  import CardRow from '../../components/CardRow.svelte';
  import CustomBtn from '../../components/buttons/CustomBtn.svelte';
  import SeeAlso from '../../components/SeeAlso.svelte';

  const seeAlsoLinks = {
    "About us": ["/about-us", "Learn more about the club"],
    "Workshop archive": ["/our-workshops", "Past workshop material"],
    "Club roadmap": ["/roadmap", "See the club roadmap"],
  }
</script>

<div class="resources">
  <div class="px-5 pt-5 pb-3">
    <h2 class="heading">Resources</h2>
    <p class="text-body">Some helpful programming resources we recommend.</p>
  </div>

  <CardRow bg='' topSpacing={false}>
    <ResourceCard category='Category 1' links={{ 'Link 1': 'https://github.com', 'Link 2': 'https://vercel.com', 'Link 3': 'https://marianopolis.edu' }} />
    <ResourceCard category='Category 2' links={{ 'Link 1': 'https://github.com', 'Link 2': 'https://vercel.com', 'Link 3': 'https://marianopolis.edu' }} />
    <ResourceCard category='Category 3' links={{ 'Link 1': 'https://github.com', 'Link 2': 'https://vercel.com', 'Link 3': 'https://marianopolis.edu' }} />
  </CardRow>
</div>

<div class="button-links px-5 pb-5 border-bottom border-white border-2">
  <h3 class="fw-bold text-black mb-4">Interested in coding, AI or hackathons?</h3>
  <div class="button-group d-grid align-items-center gap-3 gap-xl-4 gap-xxl-5">
    <CustomBtn btnStyle="secondary" expand link="https://forms.gle/yJjj42ooRk9NeB5J6">Join the Programming Club</CustomBtn>
    <CustomBtn btnStyle="secondary" expand link="https://mariai.surge.sh/">Check out the AI Club</CustomBtn>
    <CustomBtn btnStyle="secondary" expand link="https://www.marihacks.com/">We also run MariHacks!</CustomBtn>
  </div>
</div>

<SeeAlso bg='light-gray' {seeAlsoLinks} topSpacing />

<style>
.resources {
  background: linear-gradient(180deg, #fff 60%, #99C2FF 0%);
}

@media screen and (min-width: 768px) {
  .resources {
    background: linear-gradient(180deg, #fff 45%, #99C2FF 0%);
  }
}

@media screen and (min-width: 1200px) {
  .resources {
    background: linear-gradient(180deg, #fff 70%, #99C2FF 0%);
  }
}

.button-links {
  background-color: #99C2FF;
}

@media screen and (min-width: 1200px) {
  .button-group {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>