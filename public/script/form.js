// Notifications

async function softDeleteElement(element) {
  element.children.item(0).style.opacity = '0';
  setTimeout(() => { element.remove(); }, 500);
}

async function clearNotifications() {
  const notifications = document.getElementById('notifications').children;
  for (let i = 0; i < notifications.length; i++) {
    await softDeleteElement(notifications.item(i));
  }
}

async function notify(string, isError, timeout = -1) {
  const container = document.createElement('div');

  const notification = document.createElement('span');
  notification.classList.add('notification');
  notification.textContent = string;

  if (isError) {
    notification.classList.add('error');
  } else {
    notification.classList.add('info');
  }

  const br = document.createElement('br');

  container.appendChild(notification);
  container.appendChild(br);
  container.appendChild(br.cloneNode());

  container.onclick = async (event) => {
    let element;
    if (event.target.id.includes('div')) {
      element = event.target;
    } else {
      element = event.target.parentNode;
    }

    await softDeleteElement(element);
  };

  document.getElementById('notifications').appendChild(container);

  if (timeout > 0) {
    setTimeout(async () => {
      try {
        container.remove();
      } catch (e) {}
    }, timeout);
  }
}

// Event Function(s)

async function togglePassword(element) {
  const input = element.getElementById(element.getAttribute('js-for'));
  if (input.type === 'text') {
    input.type = 'password';
  } else {
    input.type = 'text';
  }
}

async function checkConfirmation(event) {
  const password = document.getElementsByName('password').item(0);

  if (password.length < 8) {
    password.setCustomValidity('Password must be longer than 8 characters.');
    return false;
  }

  const confirm = document.getElementsByName('confirm').item(0);

  if (password.value !== confirm.value) {
    confirm.setCustomValidity('Passwords do not match.');
    return false;
  }
  confirm.setCustomValidity('');
  return true;
}

// Submit Functionality

async function sendXHR(url, data, success, failure) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.responseType = 'json';

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      if (xhr.response == null) {
        notify('Unable to contact server.', true);
        return;
      }

      const result = xhr.response;
      if (!('success' in result) || result.success !== 1) {
        failure(result);
      } else {
        success(result);
      }
    }
  };

  xhr.send(JSON.stringify(data));
}

async function submitForm(event) {
  event.preventDefault();
  await clearNotifications();

  const confirmElements = document.getElementsByName('confirm');
  if (confirmElements.length > 0) {
    const result = await checkConfirmation();
    if (!result) return;
  }

  const form = event.target;
  const inputs = form.getElementsByTagName('input');
  let redirect = '';
  let successMessage = '';

  const requestBody = {};

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs.item(i);

    if (input.name === 'redirect') {
      redirect = input.value;
    } else if (input.name === 'success') {
      successMessage = input.value;
    } else if (!input.classList.contains('ignored')) requestBody[input.name] = input.value;
  }

  await sendXHR(
    form.getAttribute('js-action'),
    requestBody,
    (result) => {
    // Success
      if ('session' in result) {
        document.cookie = `session=${result.session}`;
      }

      if (successMessage !== '') {
        notify(successMessage, false);
      }

      if (redirect !== '') {
        document.location.href = redirect;
      }
    },
    (result) => {
    // Failure
      notify(result.info, true);
    },
  );
}

// Page startup logic

async function clearGetParams() {
  window.history.replaceState({}, '', window.location.pathname);
}

async function loadInfoMessage() {
  const params = new URLSearchParams(window.location.search);

  if (params.has('info')) {
    const infoMessage = params.get('info');

    if (params.has('error')) {
      await notify(infoMessage, true);
    } else {
      await notify(infoMessage, false);
    }

    await clearGetParams();
  }
}

async function addEventListeners() {
  const elements = document.getElementsByTagName('form');
  for (let i = 0; i < elements.length; i++) {
    elements.item(i).addEventListener(
      'submit',
      submitForm,
    );
  }
}

window.onload = async () => {
  await addEventListeners();
  await loadInfoMessage();
};
