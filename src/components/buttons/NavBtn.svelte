<script>
  export let link = '';
</script>

<!-- only used in topnav -->
<a href={link} class="btn light-btn m-0 mx-lg-2 px-lg-2">
  <slot></slot>
</a>

<style>
.light-btn {
  color: #fff;
  border-color: #fff;
  background-color: #050D2E;
  width: 100%;
}

.light-btn:hover {
  background-color: #fff;
  color: #050D2E;
}

@media screen and (min-width: 992px) {
  .light-btn {
    width: auto;
  }
}
</style>