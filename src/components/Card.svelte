<script>
  export let title, subtitle, desc, list, links, arrow = '';
</script>

<div class={"reg-card card rounded-0" + (arrow ? ' link-card bg-white' : ' card-light-blue')}>
  <div class={"card-body relative text-black" + (arrow ? ' py-4 ps-4' : ' p-4')}>
    <h5 class="card-title">{title}</h5>

    {#if subtitle}
    <h6 class="card-subtitle text-body-secondary mt-2">{subtitle}</h6>
    {/if}
    
    {#if desc}
    <p class={"card-text mb-0" + (subtitle ? ' mt-3' : ' mt-5')}>{desc}</p>
    {/if}

    {#if list}
    <ul class={"card-text mb-0" + (desc ? ' mt-2' : ' mt-3')}>
      {#each list as item, i (i)}
      <li>{item}</li>
      {/each}
    </ul>
    {/if}

    {#if links}
    <div class="card-links d-flex column-gap-3 row-gap-1 flex-wrap mt-3">
      {#each Object.entries(links) as [link, text]}
      <a href={link} class="d-flex align-items-center text-black"><img class="link-icon" src="/link/link-icon-dark.svg" alt={`Link to ${text}`}>{text}</a>
      {/each}
    </div>
    {/if}

    {#if arrow}
    <div class="position-absolute right-arrow"><img src="/right-arrow.svg" alt="Right arrow icon" height="15"></div>
    {/if}
  </div>
</div>

<style>
.card-light-blue {
  background-color: #CCE0FF;
}

.reg-card {
  border: solid 2px #050D2E;
}

.link-card {
  overflow: hidden; /* for hover effect, heavily inspired by https://codepen.io/andrewsims/pen/mQoYwz */
}

.link-card .card-body {
  padding-right: calc(48px + 1rem);
  z-index: 0;
  overflow: hidden;
}

/* : and :: for cross-compatibility to be safe */
.link-card .card-body::before, .link-card .card-body:before {
  content: "";
  position: absolute;
  z-index: -1;
  right: 0;
  bottom: 0;
  width: 44px;
  height: 44px;
  transform: scale(1);
  transform-origin: 50% 50%;
  background-color: #050D2E;
  transition: transform 0.25s ease-out;
}

.link-card .card-body:hover::before, .link-card .card-body:hover:before {
  transform: scale(21);
}

.link-card .card-body:hover h5, .link-card .card-body:hover h6, .link-card .card-body:hover p, .link-card .card-body:hover ul {
  color: #fff;
  transition: color 0.3 ease-out;
}

.right-arrow {
  right: 0;
  bottom: 0;
  padding: 12px 10px 10px 12px;
  background-color: #050D2E;
}

.link-icon {
  margin-right: 0.35rem;
}

.card-links a {
  text-decoration: none;
}

.card-links a:hover {
  text-decoration: underline;
}
</style>