async function test(arg) {
    console.log("Test function ran with: " + arg);
}

test.apply(this, ["yay"]);