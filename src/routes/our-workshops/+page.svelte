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
    "Club roadmap": ["/roadmap", "See the club roadmap"],
  }
</script>

<div class="pt-5 px-5 pb-3">
  <h2 class="heading">Our workshops</h2>
  <p class="text-body">Here's the past material from our club workshops!</p>
</div>

<CardRow topSpacing={false}>
  <Card title='#1: Intro to Python' subtitle='Python Basics' desc='Short workshop description for workshop 1 here...' list='' 
  links={{ 'Slides': 'https://slides.google.com/',
           'Colab': 'https://colab.research.google.com/',
           'GitHub': 'https://github.com/' }} 
  arrow='' />
  <Card title='#2: Functions and Lists' subtitle='Python Basics' desc='Short workshop description for workshop 2 here...' list='' 
  links={{ 'Slides': 'https://slides.google.com/',
           'Colab': 'https://colab.research.google.com/',
           'GitHub': 'https://github.com/' }} 
  arrow='' />
  <Card title='#3: Manipulating Dictionaries and Lists' subtitle='Python Basics' desc='Short workshop description for workshop 3 here...' list='' 
  links={{ 'Slides': 'https://slides.google.com/',
           'Colab': 'https://colab.research.google.com/',
           'GitHub': 'https://github.com/' }} 
  arrow='' />
  <Card title='#4: NumPy' subtitle='Python Libraries' desc='Short workshop description for workshop 4 here...' list='' 
  links={{ 'Slides': 'https://slides.google.com/',
           'Colab': 'https://colab.research.google.com/',
           'GitHub': 'https://github.com/' }} 
  arrow='' />
  <Card title='#5: Matplotlib' subtitle='Python Libraries' desc='Short workshop description for workshop 5 here...' list='' 
  links={{ 'Slides': 'https://slides.google.com/',
           'Colab': 'https://colab.research.google.com/',
           'GitHub': 'https://github.com/' }} 
  arrow='' />
  <Card title='#5.5: Review Workshop 1' subtitle='Review' desc='Short workshop description for workshop 5.5 here...' list='' 
  links={{ 'Slides': 'https://slides.google.com/',
           'Problem set': 'https://colab.research.google.com/',
           'Solutions': 'https://colab.research.google.com/',
           'GitHub': 'https://github.com/' }} 
  arrow='' />
</CardRow>

<SeeAlso bg='light-gray' topSpacing {seeAlsoLinks} />
