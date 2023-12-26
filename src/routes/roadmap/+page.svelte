<svelte:head>
  <meta name="description" content="Archive of Programming Club workshop material">
  <title>Our workshops | Programming Club</title>
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
  <Card title='Weeks 1-3: Algorithms and DS, OOP' subtitle='Mid January - Early February' desc='' list={['Item 1', 'Item 2', 'Item 3']} links='' arrow='' />
  <Card title='Weeks 4-6: Web development' subtitle='Mid February - Early March' desc='' list={['HTML and CSS', 'JavaScript', 'React.js']} links='' arrow='' />
  <Card title='Weeks 7-8: Applications of Python' subtitle='Mid March' desc='' list={['Data science', 'Backend development', 'Item 3', 'Item 4']} links='' arrow='' />
  <Card title='Weeks 1-3: Algorithms and DS, OOP' subtitle='Mid January - Early February' desc='' list={['Item 1', 'Item 2', 'Item 3']} links='' arrow='' />
  <Card title='Weeks 4-6: Web development' subtitle='Mid February - Early March' desc='' list={['HTML and CSS', 'JavaScript', 'React.js']} links='' arrow='' />
  <Card title='Weeks 7-8: Applications of Python' subtitle='Mid March' desc='' list={['Data science', 'Backend development', 'Item 3', 'Item 4']} links='' arrow='' />
</CardRow>

<SeeAlso bg='light-gray' topSpacing {seeAlsoLinks} />
