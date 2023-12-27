<script>
  import { page } from '$app/stores';
  import SeeAlso from '../components/SeeAlso.svelte';
  
  const seeAlsoLinks = {
    "Home": ["/", "The home page"],
    "About us": ["/about-us", "Learn more about the club"],
    "Workshop archive": ["/our-workshops", "Past workshop material"],
    "Club roadmap": ["/roadmap", "See the club roadmap"],
    "Resources": ["/resources", "Coding resources we recommend"],
    "Sign up now!": ["https://forms.gle/yJjj42ooRk9NeB5J6", "Join our Discord too :)"],
  }
  </script>

<svelte:head>
  <meta name="description" content="Welcome to the Marianopolis Programming Club!">
  <title>{$page.status}: {$page.error?.message} | Programming Club</title>
</svelte:head>

<h2 class="alert alert-danger w-100 text-center">{$page.status}: {$page.error?.message}</h2>

<div class="px-5 py-3 text-body">
  <p>Looks like something went wrong, sorry about that :/ We hope the links below will help!</p>
  <p>Feel free to reach out to us on Discord, Instagram, or Omnivox as well — we're happy to help, whether you have coding questions, suggestions, or other concerns :)</p>
  <ul class="d-flex flex-column gap-2">
    <li>Discord: look for users <a href="https://discord.gg/BMvrpKJjej">in our club server</a> with <strong>Exec 'year</strong> (e.g. Exec '24)
       in their username who have the <strong>executive and/or organizer role</strong>!</li>
    <li>Instagram: you can find us at <a href="https://www.instagram.com/mari_programming_club/">@mari_programming_club</a> or <a href="https://www.instagram.com/marihacks">@marihacks</a></li>
    <li>Omnivox: check your MIOs from us :)</li>
  </ul>

</div>

<SeeAlso bg='light-gray' topSpacing {seeAlsoLinks} />