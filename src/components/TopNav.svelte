<script>
  export let path = '';
</script>

<nav class="navbar navbar-expand-lg topnav text-center">
  <div class="container-fluid">
    <div class="collapse navbar-collapse mt-4" id="topnav-collapse">
      <ul class="navbar-nav me-auto mb-lg-0">
        <li class="nav-item">
          <a class="nav-link active" aria-current="page" href="/">Home</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="/about-us">About us</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="/our-workshops">Our workshops</a>
        </li>
      </ul>
    </div>
    <a class="navbar-brand mx-auto position-relative order-first order-lg-0" id="topnav-brand" href="/">
      <img src="/favicon.svg" alt="Logo" height="40" class="d-inline-block d-lg-none">
      <img src="/logo-full.svg" alt="Logo" height="40" class="d-lg-inline-block d-none">
    </a>
    <button class="navbar-toggler bg-white px-2 order-first order-lg-0" type="button" data-bs-toggle="collapse" data-bs-target="#topnav-collapse" aria-controls="topnav-collapse" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse mb-4 mb-lg-0" id="topnav-collapse">
      <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
        <li class="nav-item">
          <a class="nav-link active" aria-current="page" href="/resources">Resources</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="/roadmap">Roadmap</a>
        </li>
      </ul>
      <a href="https://forms.gle/yJjj42ooRk9NeB5J6" class="btn btn-light btn-lg-outline-light m-0 ms-lg-2 px-lg-2">Sign up!</a>
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
}

@media screen and (min-width: 992px) {
  #topnav-brand {
    left: 0;
  }
}
</style>