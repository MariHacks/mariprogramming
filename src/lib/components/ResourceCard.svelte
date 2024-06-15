<script>
  export let category, links;
</script>

<div class="res-card card rounded-0">
  <div class="card-header rounded-0">
    <h5 class="card-title text-black fw-semibold py-1 mb-0">{category}</h5>
  </div>
  <div class="card-body">
    <ul class="resources-col d-flex flex-column justify-content-between px-1">
      {#each Object.entries(links) as [text, link]}
      <li class="resource-link"><a href={link} class="text-white"><img src="/link/link-icon-light.svg" alt="Light gray link icon">{text}</a></li>
      {/each}
    </ul>
  </div>
</div>

<style>
.resources-col {
  padding: 0;
  margin: 0;
  row-gap: 0.75rem;
}

.resource-link {
  list-style: none;
  display: flex;
  align-items: center;
  font-size: 1.05rem;
}

.resource-link a img {
  margin-right: 0.5rem;
}

.resource-link a {
  text-decoration: none;
}

.resource-link a:hover {
  text-decoration: underline;
}

.res-card {
  border: solid 2px #050D2E;
  height: 100%;
}

.res-card .card-header {
  border-bottom: solid 1px #050D2E;
  background-color: #CCC8E9;
}

.res-card .card-body {
  background-color: #050D2E;
}
</style>