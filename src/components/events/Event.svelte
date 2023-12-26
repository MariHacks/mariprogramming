<script>
  export let name, date, desc;
</script>

<div class="card rounded-0 event p-1 p-sm-3 mx-auto">
  <div class="card-body text-black d-flex flex-column justify-content-between">
    <div>
      <h5 class="card-title fw-semibold">{name}</h5>
      <h6 class="card-subtitle mt-1">{date}</h6>
    </div>
    <p class="card-text mt-4">{desc}</p>
  </div>
</div>

<style>
.event {
  border: solid 2px #050D2E;
  height: 100%;
  width: 70%;
}

@media screen and (min-width: 340px) {
  .event {
    cursor: grab;
  }
}

@media screen and (min-width: 576px) {
  .event {
    width: 80%;
  }
}
</style>