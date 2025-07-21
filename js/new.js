(function(){
  const { useState } = React;
  const { useForm } = ReactHookForm;
  const { Tab } = window.HeadlessUIReact;

  function AddBookWizard(){
    const [step, setStep] = useState(0);
    const [apiData, setApiData] = useState({});
    const [coverFile, setCoverFile] = useState(null);
    const { register, handleSubmit, setValue, getValues, reset } = useForm();

    async function searchBook(){
      const qs = getValues();
      const params = qs.isbn ? `isbn=${qs.isbn}` : `title=${encodeURIComponent(qs.title)}`;
      const res = await fetch(`/api/bookmeta?${params}`);
      const json = await res.json();
      if(json.ok){
        setApiData(json.data);
        Object.keys(json.data).forEach(k=> setValue(k, json.data[k]));
        setStep(1);
      } else {
        alert('Book not found');
      }
    }

    function resetField(name){
      if(apiData[name]!==undefined) setValue(name, apiData[name]);
    }

    const onFinish = async data => {
      const payload = { newBook: data, defaultsFromAPI: apiData };
      if(coverFile){
        const base64 = await fileToBase64(coverFile);
        payload.coverFile = { data: base64, fileName: coverFile.name, mimeType: coverFile.type };
      }
      const res = await fetch('/.netlify/functions/addBook', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const out = await res.json();
      if(out.success){
        alert('Book added');
      } else {
        alert(out.message);
      }
    };

    return React.createElement(Tab.Group, {selectedIndex:step, onChange:setStep},
      React.createElement(Tab.List, null,
        ['Search','Preview','Upload Cover'].map((t,i)=>React.createElement(Tab,{key:i},t))
      ),
      React.createElement(Tab.Panels,null,
        React.createElement(Tab.Panel,null,
          React.createElement('div',null,
            React.createElement('input', { placeholder:'ISBN', ...register('isbn')}),
            React.createElement('input', { placeholder:'Title', ...register('title')}),
            React.createElement('button',{onClick:searchBook},'Search')
          )
        ),
        React.createElement(Tab.Panel,null,
          React.createElement('form',{onSubmit:handleSubmit(()=>setStep(2))},
            React.createElement('input',{placeholder:'Title',...register('title')}),
            React.createElement('button',{type:'button',onClick:()=>resetField('title')},'Reset'),
            React.createElement('input',{placeholder:'Authors comma separated',...register('authors')}),
            React.createElement('button',{type:'button',onClick:()=>resetField('authors')},'Reset'),
            React.createElement('textarea',{placeholder:'Description',...register('description')}),
            React.createElement('button',{type:'submit'},'Next')
          )
        ),
        React.createElement(Tab.Panel,null,
          React.createElement('div',null,
            React.createElement('input',{type:'file',accept:'image/*',onChange:e=>setCoverFile(e.target.files[0])}),
            React.createElement('button',{onClick:handleSubmit(onFinish)},'Finish')
          )
        )
      )
    );
  }

  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result.split(',')[1]);
      r.onerror=reject;
      r.readAsDataURL(file);
    });
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AddBookWizard));
})();
