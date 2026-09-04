'use strict';
(function(){
  const lists=['scheduledJobs','notificationQueue','dataRequests','supportBundles','onboardingRuns','whiteLabelProfiles','remoteConfigs','dataRetentionPolicies'];
  for(const key of lists){if(!Array.isArray(state[key]))state[key]=[];}
  state.platform={locale:'fr',direction:'ltr',onboardingComplete:false,appChannel:'ANDROID',schemaRegistryVersion:1,...(state.platform||{})};
  state.dataGovernance={customerRetentionDays:1825,auditRetentionDays:3650,allowCustomerAnonymization:true,...(state.dataGovernance||{})};
})();
