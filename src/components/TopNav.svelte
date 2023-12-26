<script>
  export let path = '';

  import NavBtn from "./buttons/NavBtn.svelte";
</script>

<nav class="navbar navbar-expand-lg topnav text-center">
  <div class="container-fluid">
    <div class="collapse navbar-collapse mt-2 mt-lg-0" id="topnav-collapse">
      <ul class="navbar-nav me-auto mb-lg-0">
        <li class="nav-item">
          <a class={"nav-link" + ('/' === path ? ' active' : '')} href="/">Home</a>
        </li>
        <li class="nav-item">
          <a class={"nav-link" + ('/about-us' === path ? ' active' : '')} href="/about-us">About us</a>
        </li>
        <li class="nav-item">
          <a class={"nav-link" + ('/our-workshops' === path ? ' active' : '')} href="/our-workshops">Our workshops</a>
        </li>
      </ul>
    </div>
    <a class="navbar-brand mx-auto position-relative order-first order-lg-0" id="topnav-brand" href="/">
      <img src="/logo-icon.svg" alt="Marianopolis Programming Club logo" height="40" class="d-inline-block d-lg-none">
      <img src="/logo-full.svg" alt="Marianopolis Programming Club logo" height="40" class="d-lg-inline-block d-none">
    </a>
    <button class="navbar-toggler bg-white px-2 order-first order-lg-0" type="button" data-bs-toggle="collapse" data-bs-target="#topnav-collapse" aria-controls="topnav-collapse" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse mb-2 mb-lg-0" id="topnav-collapse">
      <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
        <li class="nav-item">
          <a class={"nav-link" + ('/resources' === path ? ' active' : '')} href="/resources">Resources</a>
        </li>
        <li class="nav-item">
          <a class={"nav-link" + ('/roadmap' === path ? ' active' : '')} href="/roadmap">Roadmap</a>
        </li>
      </ul>
      <NavBtn link="https://forms.gle/yJjj42ooRk9NeB5J6">Sign up!</NavBtn>
    </div>
  </div>
</nav>

<style>
.topnav {
  background-color: #050D2E;
}

.topnav div ul a {
  color: #fff;
}

#topnav-brand {
  left: 24px;
  transition: background-color 0.15s ease-in-out;
}

.nav-link {
  transition: background-color 0.15s ease-in-out;
  border-radius: 6px;
  word-spacing: -3.5px;
}

.nav-link:hover {
  background-color: #0D2173;
}

.nav-link.active {
  text-decoration: underline;
}

@media screen and (min-width: 992px) {
  #topnav-brand {
    left: 0;
  }
}
</style>