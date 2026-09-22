const FormData = require('form-data');
const axios = require('axios');

async function test() {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', Buffer.from('hello world'), { filename: 'test.txt' });
  try {
    const res = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: form.getHeaders()
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
