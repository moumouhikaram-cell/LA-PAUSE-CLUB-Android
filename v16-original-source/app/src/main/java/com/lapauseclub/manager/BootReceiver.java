package com.lapauseclub.manager;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            SharedPreferences prefs=context.getSharedPreferences("gaming_floor_store",Context.MODE_PRIVATE);
            String raw=prefs.getString("state_json",""); if(raw.isEmpty())return;
            JSONObject state=new JSONObject(raw); JSONArray sessions=state.optJSONArray("sessions"); JSONArray stations=state.optJSONArray("stations");
            int warningMinutes=state.optJSONObject("sessionRules")!=null?state.optJSONObject("sessionRules").optInt("warningMinutes",5):5;
            if(sessions==null)return;
            for(int i=0;i<sessions.length();i++){
                JSONObject s=sessions.optJSONObject(i); if(s==null||!"active".equals(s.optString("status")))continue;
                long end=s.optLong("endAt",0); if(end<=System.currentTimeMillis())continue;
                String sid=s.optString("id",""); String stid=s.optString("stationId",""); String name="Poste";
                if(stations!=null)for(int j=0;j<stations.length();j++){JSONObject st=stations.optJSONObject(j);if(st!=null&&stid.equals(st.optString("id"))){name=st.optString("name","Poste");break;}}
                MainActivity.scheduleNativeAlerts(context,sid,end,end-warningMinutes*60000L,name);
            }
        } catch(Exception ignored) {}
    }
}
