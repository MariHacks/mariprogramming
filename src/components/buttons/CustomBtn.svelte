<script>
  export let link, btnStyle, expand;
</script>

<a href={link} class={`btn ${expand ? 'expand' : 'custom-btn'} ${btnStyle}-btn m-0 py-2 mx-lg-2 px-lg-2 border-2`}>
  <slot></slot>
</a>

<style>
.custom-btn, .expand {
  width: 100%;
}

@media screen and (min-width: 992px) {
  .custom-btn {
    width: 75%;
  }
}

@media screen and (min-width: 1200px) {
  .custom-btn {
    width: 50%;
  }
}

@media screen and (min-width: 1440px) {
  .custom-btn {
    width: 20%;
  }
}

/* button styles (feel free to add more) */
.primary-btn {
  color: #0D2173;
  border-color: #0D2173;
  background-color: #fff;
}

.primary-btn:hover {
  background-color: #0D2173;
  color: #fff;
}

.secondary-btn {
  color: #050D2E;
  border-color: #050D2E;
  background-color: #fff;
}

.secondary-btn:hover {
  background-color: #050D2E;
  color: #fff;
}
</style>