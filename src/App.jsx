import React, { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { v4 as uuidv4 } from "uuid";
import {
  listAll,
  upsertRecord,
  deleteRecord,
  exportBackupJSON,
  importBackupJSON
} from "./db.js";

function toDateStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function formatNet(n){
  return n >= 0 ? `+NT$${n}` : `-NT$${Math.abs(n)}`;
}

const PRESETS = ["30/10", "50/20", "100/10", "100/20"];

export default function App(){
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(new Date());
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);

  async function refresh(){
    const all = await listAll();
    setRecords(all);
  }

  useEffect(()=>{ refresh(); },[]);

  const selectedStr = toDateStr(selected);

  const recordsOfDay = records.filter(r => r.date === selectedStr);

  const year = new Date().getFullYear();
  const yearRecords = records.filter(r => r.date.startsWith(String(year)));

  const stats = useMemo(()=>{
    let win=0, loss=0, net=0;
    yearRecords.forEach(r=>{
      net += r.net;
      if (r.net > 0) win += r.net;
      if (r.net < 0) loss += Math.abs(r.net);
    });
    return { win, loss, net };
  },[yearRecords]);

  const dailyMap = useMemo(()=>{
    const m = {};
    yearRecords.forEach(r=>{
      m[r.date] = (m[r.date]||0) + r.net;
    });
    return m;
  },[yearRecords]);

  async function handleSave(record){
    await upsertRecord(record);
    setShowForm(false);
    setEditing(null);
    refresh();
  }

  async function handleDelete(id){
    if(confirm("確定刪除？")){
      await deleteRecord(id);
      refresh();
    }
  }

  async function backup(){
    const json = await exportBackupJSON();
    const blob = new Blob([json], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mahjong-backup.json";
    a.click();
  }

  async function restore(e){
    const file = e.target.files[0];
    if(!file) return;
    if(!confirm("會覆蓋所有資料，確定？")) return;
    await importBackupJSON(await file.text());
    refresh();
  }

  return (
    <div style={{padding:12, color:"#e5e7eb"}}>
      <h2>信義分隊雀神戰</h2>

      <div style={{display:"flex", gap:8}}>
        <div>總贏 NT${stats.win}</div>
        <div>總輸 NT${stats.loss}</div>
        <div>淨值 NT${stats.net}</div>
      </div>

      <DayPicker
        mode="single"
        selected={selected}
        onSelect={setSelected}
        components={{
          Day: ({ date })=>{
            const key = toDateStr(date);
            const sum = dailyMap[key] || 0;
            return (
              <div style={{position:"relative", width:36, height:36}}>
                {date.getDate()}
                {sum!==0 && (
                  <div style={{
                    position:"absolute",
                    bottom:0,
                    fontSize:10,
                    color: sum>0?"#22c55e":"#ef4444"
                  }}>
                    {sum>0?`+${sum}`:`-${Math.abs(sum)}`}
                  </div>
                )}
              </div>
            );
          }
        }}
      />

      <button onClick={()=>setShowForm(true)}>新增</button>
      <button onClick={backup}>備份</button>
      <button onClick={()=>fileInputRef.current.click()}>還原</button>
      <input type="file" hidden ref={fileInputRef} onChange={restore} />

      <ul>
        {recordsOfDay.map(r=>(
          <li key={r.id}>
            {r.location||"未填"} / {r.stake} / {r.hands} 將
            <b>{formatNet(r.net)}</b>
            <button onClick={()=>{setEditing(r); setShowForm(true);}}>改</button>
            <button onClick={()=>handleDelete(r.id)}>刪</button>
          </li>
        ))}
      </ul>

      {showForm && (
        <Form
          onClose={()=>{setShowForm(false); setEditing(null);}}
          onSave={handleSave}
          editing={editing}
          date={selectedStr}
        />
      )}
    </div>
  );
}

function Form({ onClose, onSave, editing, date }){
  const [location,setLocation]=useState(editing?.location||"");
  const [stake,setStake]=useState(editing?.stake||"30/10");
  const [hands,setHands]=useState(editing?.hands||1);
  const [net,setNet]=useState(editing?.net||0);

  return (
    <div>
      <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="地點" />
      <select value={stake} onChange={e=>setStake(e.target.value)}>
        {PRESETS.map(p=><option key={p}>{p}</option>)}
      </select>
      <input type="number" value={hands} onChange={e=>setHands(+e.target.value)} />
      <input type="number" value={net} onChange={e=>setNet(+e.target.value)} />
      <button onClick={()=>{
        onSave({
          id: editing?.id || uuidv4(),
          date,
          location,
          stake,
          hands,
          net
        });
      }}>存</button>
      <button onClick={onClose}>取消</button>
    </div>
  );
}
