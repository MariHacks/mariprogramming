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
    <ResourceCard category='Coding courses' 
                  links={{ 'freeCodeCamp': 'https://www.freecodecamp.org/learn', 'Codecademy': 'https://www.codecademy.com/', 
                           'The Odin Project (web dev)': 'https://www.theodinproject.com/', 'Harvard CS50x: Introduction to CS': 'https://cs50.harvard.edu/x/',
                           'Google Developers Web (web dev)': 'https://web.dev/learn' }} />
    <ResourceCard category='Coding YouTube channels' 
                  links={{ 'freeCodeCamp on YT': 'https://www.youtube.com/@freecodecamp', 'Tech with Tim': 'https://www.youtube.com/@TechWithTim', 
                           'Traversy Media': 'https://www.youtube.com/@TraversyMedia', 'Coder Coder (web dev)': 'https://www.youtube.com/@TheCoderCoder',
                           'Pooky Codes': 'https://www.youtube.com/@PookyCodes' }} />
    <ResourceCard category='Coding practice and forums' 
                  links={{ 'LeetCode': 'https://leetcode.com/', 'Codewars': 'https://www.codewars.com/', 'HackerRank': 'https://www.hackerrank.com/', 
                           'Frontend Mentor (frontend challenges)': 'https://www.frontendmentor.io/challenges', 'Stack Overflow': 'https://stackoverflow.com/' }} />
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