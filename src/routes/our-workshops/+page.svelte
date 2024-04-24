<svelte:head>
  <meta name="description" content="Archive of Programming Club workshop material">
  <title>Our workshops | Programming Club</title>
</svelte:head>

<script>
  import CardRow from '../../components/CardRow.svelte';
  import Card from '../../components/Card.svelte';
  import SeeAlso from '../../components/SeeAlso.svelte';

  const seeAlsoLinks = {
    // "Sign up for MariHacks!": ["https://www.marihacks.com", "Deadline is March 10, 11:59 pm EST"],
    // "Sign up now!": ["https://forms.gle/yJjj42ooRk9NeB5J6", "Join our Discord too :)"],
    "Exec applications are open!": ["https://forms.gle/pjxRBgioWrTS6Wc9A", "Apply by May 3, 10:00 pm EST!"],
    "About us": ["/about-us", "Learn more about the club"],
    "Club roadmap": ["/roadmap", "See the club roadmap"],
  }
</script>

<div class="pt-5 px-5 pb-3">
  <h2 class="heading">Our workshops</h2>
  <p class="text-body">Here's the past material from our 2023-24 club workshops!</p>
</div>

<CardRow topSpacing={false}>
  <Card title='#1: Intro to Python' subtitle='Python Basics' desc='The basics of Python: variables, data types, operations, conditional statements and loops.' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1MNX3TRe8Rzh_st2cG6TyUjDhHmbPRdsMHE0lI2--2Ho/edit?usp=drive_link',
           'Colab': 'https://colab.research.google.com/drive/1UX_XKx1KWytoyxW7XACD2GparE-TPQU3?usp=sharing' }} 
  arrow='' />
  <Card title='#2: Functions and Lists' subtitle='Python Basics' desc='More Python basics: loops, lists, functions, dictionaries, etc.' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1QVGR1s9O3rBgoNJ8uCYrX1818NZHO8ZBH3mKDcvxrZI/edit?usp=sharing' }} 
  arrow='' />
  <Card title='#3: Manipulating Dictionaries and Lists' subtitle='Python Basics' desc='Dictionary and list manipulation: list and dictionary comprehensions, tuples, destructuring, etc.' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1rfqu_Dw09ZJm3pn5zqhRVWJ2DHssq5XXREJT0O5kYVM/edit?usp=sharing' }} 
  arrow='' />
  <Card title='#3.5: Strings and Files' subtitle='Python Basics' desc='String and file basics: character codes, strings, manipulating files.' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1gnF6-zQ6X_ED3XhfKA_rlcbomAJhIHEeSqOYqPfrJLM/edit?usp=sharing' }} 
  arrow='' />
  <Card title='#4: NumPy' subtitle='Python Libraries' desc='The fundamentals of the NumPy library: working with NumPy arrays (shape, dimension, operations...).' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1wuC7wCAerBPxLYiQRHgRp6zLSTp1cbIUUsiASsj94Co/edit?usp=sharing' }} 
  arrow='' />
  <Card title='#5: Matplotlib' subtitle='Python Libraries' desc='Matplotlib library basics: generating and customizing plots.' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1jkPRUiXcry1UExDtmLrt6JVCmVcy9O6KB5NBIjO1mXE/edit?usp=sharing' }} 
  arrow='' />
  <Card title='#5.5: Review Workshop 1' subtitle='Review' desc='A review of everything we covered in previous workshops: the basics of Python and some Python libraries!' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1QETOIuXHtx2YUJXBGuVClhjnKoCCsB_mJs9dtq9KYpQ/edit?usp=sharing',
           'Problem set': 'https://colab.research.google.com/drive/1GWQT1ciq4VNblDmxJPyom11JyqZg9EvV?usp=sharing',
           'Solutions to problem set': 'https://colab.research.google.com/drive/1bSJggUXE4x-r3jQ8wwcGUAd14xQVuMs_?usp=sharing' }} 
  arrow='' />
  <Card title='#6: Object-Oriented Programming 1' subtitle='OOP' desc='We start with basic OOP concepts (creating classes, etc.) and gradually delve into more advanced and interesting applications.' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1LNfJLjlheS1SMNjqB1aNcXEuXffYOkMywmSv4qvUDEQ/edit?usp=sharing',
           'Code examples': 'https://github.com/MariHacks/workshops-2023-2024/tree/main/OOP' }} 
  arrow='' />
  <Card title='MariHacks special #1: Python Libraries' subtitle='MariHacks prep' desc='We briefly discuss lots of popular and useful Python libraries that could come in handy at MariHacks!' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1BP8OQZS9y7Ew_3Oq9zr1Ns2Ta2BVBLPtlPmfvu4RR34/edit?usp=sharing',
           'Code examples': 'https://github.com/MariHacks/workshops-2023-2024/tree/main/marihacks_prep' }} 
  arrow='' />
  <!-- <Card title='MariHacks special #2: Hackathon Tools' subtitle='MariHacks prep' desc='We go over some essential tools for hackathons (and coding projects in general), such as !' list='' 
  links={{ 'Slides': 'https://docs.google.com/presentation/d/1BP8OQZS9y7Ew_3Oq9zr1Ns2Ta2BVBLPtlPmfvu4RR34/edit?usp=sharing' }} 
  arrow='' /> -->
</CardRow>

<SeeAlso bg='light-gray' topSpacing {seeAlsoLinks} />
