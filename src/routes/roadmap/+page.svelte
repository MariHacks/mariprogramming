<svelte:head>
  <meta name="description" content="Roadmap of Programming Club activities">
  <title>Roadmap | Programming Club</title>
</svelte:head>

<script>
  import CardRow from '../../components/CardRow.svelte';
  import Card from '../../components/Card.svelte';
  import SeeAlso from '../../components/SeeAlso.svelte';

  const seeAlsoLinks = {
    "Sign up now!": ["https://forms.gle/yJjj42ooRk9NeB5J6", "Join our Discord too :)"],
    "About us": ["/about-us", "Learn more about the club"],
    "Workshop archive": ["/our-workshops", "Past workshop material"],
  }
</script>

<div class="pt-5 px-5 pb-3">
  <h2 class="heading">Roadmap</h2>
  <p class="text-body">This is a (tentative) roadmap of our Winter 2024 activities. Suggestions/requests are welcome: don't hesitate to contact us on Discord, Instagram or Omnivox :)</p>
</div>

<CardRow topSpacing={false}>
  <Card title='Weeks 1-2: Algorithms and DS' subtitle='Mid - end of January' desc='' list={['Algorithms', 'Data structures', 'Fundamental coding concepts']} links='' arrow='' />
  <Card title='Week 3: Object-oriented programming' subtitle='Early February' desc='' 
  list={['The OOP paradigm', 'Classes and objects', 'Encapsulation, inheritance, polymorphism']} links='' arrow='' />
  <Card title='Weeks 4-6: Web development' subtitle='Mid February - Early March' desc='' list={['HTML and CSS', 'JavaScript', 'React.js']} links='' arrow='' />
  <Card title='Weeks 7-8: Applications of Python' subtitle='Mid March' desc='' 
  list={['Topics to be confirmed based on interest and resources', 'Data science', 'Backend development']} links='' arrow='' />
  <Card title='Week 9: MariHacks VII' subtitle='April 5-6' desc='' 
        list={['24-hour in-person hackathon at Marianopolis', 'Open to high school and CEGEP students', 'Beginner and advanced challenges', 'Workshops and seminars', 'Free food and prizes!']} 
        links={{ 'MariHacks website': 'https://www.marihacks.com/' }} arrow='' />
  <Card title='Weeks 9+: Applications of Programming' subtitle='End of March - End of April' desc='' 
        list={['Topics depend on interest and resources', 'Arduino (hardware/robotics)', 'Game development', 'Backend with JavaScript', 'Command line scripting']} links='' arrow='' />
</CardRow>

<SeeAlso bg='light-gray' topSpacing {seeAlsoLinks} />
